import { BadRequestException, Body, Controller, Get, HttpCode, NotFoundException, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { Db } from './db';
import { LiveHub } from './live';
import { AuthGuard, AuthUser, CurrentUser } from './auth';

const TYPES = ['started', 'attempt', 'hint_shown', 'completed', 'abandoned'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Controller()
@UseGuards(AuthGuard)
export class SyncController {
  constructor(private db: Db, private hub: LiveHub) {}

  @Get('content/packs/latest')
  async latest(@Query('age') age: string, @Query('haveVersion') have: string | undefined, @Res({ passthrough: true }) res: Response) {
    const a = Number(age);
    if (!Number.isInteger(a) || a < 3 || a > 8) throw new BadRequestException('age 3–8');
    const r = await this.db.pool.query(
      "SELECT version, manifest FROM content_packs WHERE status='published' AND min_age<=$1 AND max_age>=$1 ORDER BY version DESC LIMIT 1", [a]);
    if (!r.rowCount) throw new NotFoundException('belum ada konten untuk usia ini');
    if (have && Number(have) >= r.rows[0].version) { res.status(304); return; }
    return r.rows[0];
  }

  @Post('sync/events')
  @HttpCode(200)
  async events(@CurrentUser() u: AuthUser, @Body() b: any) {
    const evs = b?.events;
    if (!Array.isArray(evs) || evs.length > 500) throw new BadRequestException('events harus array maks 500');
    for (const e of evs) {
      if (!UUID.test(e?.id) || !UUID.test(e?.childId) || !e?.activityId || !Number.isInteger(e?.contentVersion)
        || !TYPES.includes(e?.type) || Number.isNaN(Date.parse(e?.deviceTs))) throw new BadRequestException('event tidak valid');
    }
    return this.db.withTenant(u.tenantId, async (c) => {
      const kids = new Set(evs.map((e: any) => e.childId));
      for (const id of kids) {
        const r = await c.query('SELECT parent_id FROM child_profiles WHERE id=$1 AND deleted_at IS NULL', [id]);
        const own = u.role === 'student' ? id === u.sub : r.rows[0]?.parent_id === u.sub;
        if (!r.rowCount || !own) throw new NotFoundException('anak tidak ditemukan');
      }
      let accepted = 0;
      const fresh: any[] = [];
      for (const e of evs) {
        const r = await c.query(
          `INSERT INTO gameplay_events(id,tenant_id,child_id,activity_id,content_version,type,payload,device_ts)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
          [e.id, u.tenantId, e.childId, e.activityId, e.contentVersion, e.type, e.payload ?? {}, e.deviceTs]);
        accepted += r.rowCount ?? 0;
        if (r.rowCount) fresh.push(e);
      }
      // Teruskan ke dasbor guru (hanya murid sekolah, event baru saja; data minimum).
      if (fresh.length) {
        const kids = (await c.query('SELECT id, alias, class_id FROM child_profiles WHERE id = ANY($1::uuid[]) AND class_id IS NOT NULL', [[...new Set(fresh.map((e) => e.childId))]])).rows;
        const byId = new Map(kids.map((k: any) => [k.id, k]));
        for (const e of fresh) {
          const k: any = byId.get(e.childId);
          if (!k) continue;
          this.hub.publish(u.tenantId, {
            classId: k.class_id, studentId: k.id, alias: k.alias, activityId: e.activityId, type: e.type,
            level: Number.isInteger(Number(e.payload?.level)) ? Number(e.payload.level) : null, ts: e.deviceTs,
          });
        }
      }
      // Server authority: balas dengan kebijakan terbaru anak pertama bila ada.
      let policy;
      const first = evs[0]?.childId;
      if (first) {
        const p = (await c.query('SELECT * FROM screen_time_policies WHERE child_id=$1', [first])).rows[0];
        if (p) policy = { dailyMinutes: p.daily_minutes, sessionMinutes: p.session_minutes,
          allowedFrom: p.allowed_from?.slice(0, 5), allowedTo: p.allowed_to?.slice(0, 5), version: p.version };
      }
      return { accepted, duplicates: evs.length - accepted, policy };
    });
  }
}
