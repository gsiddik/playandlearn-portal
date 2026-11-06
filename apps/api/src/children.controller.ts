import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, HttpCode, NotFoundException, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { PoolClient } from 'pg';
import { Db } from './db';
import { AuthGuard, AuthUser, CurrentUser } from './auth';

const toChild = (r: any) => ({ id: r.id, pseudonym: r.pseudonym, alias: r.alias, birthYear: r.birth_year, avatarId: r.avatar_id ?? undefined });
const toPolicy = (r: any) => ({
  dailyMinutes: r.daily_minutes, sessionMinutes: r.session_minutes,
  allowedFrom: r.allowed_from?.slice(0, 5) ?? undefined, allowedTo: r.allowed_to?.slice(0, 5) ?? undefined, version: r.version,
});

async function ownChild(c: PoolClient, u: AuthUser, id: string) {
  const r = await c.query('SELECT * FROM child_profiles WHERE id=$1 AND deleted_at IS NULL', [id]);
  if (!r.rowCount) throw new NotFoundException();
  if (r.rows[0].parent_id !== u.sub) throw new ForbiddenException();
  return r.rows[0];
}
function requireParent(u: AuthUser) { if (u.role !== 'parent') throw new ForbiddenException(); }

@Controller('children')
@UseGuards(AuthGuard)
export class ChildrenController {
  constructor(private db: Db) {}

  @Get()
  list(@CurrentUser() u: AuthUser) {
    requireParent(u);
    return this.db.withTenant(u.tenantId, async (c) =>
      (await c.query('SELECT * FROM child_profiles WHERE parent_id=$1 AND deleted_at IS NULL ORDER BY created_at', [u.sub])).rows.map(toChild));
  }

  @Post()
  create(@CurrentUser() u: AuthUser, @Body() b: any) {
    requireParent(u);
    const alias = String(b?.alias ?? '').trim();
    const year = Number(b?.birthYear);
    if (!alias || alias.length > 30) throw new BadRequestException('alias wajib, maks 30 karakter');
    if (!Number.isInteger(year) || year < 2010 || year > new Date().getFullYear()) throw new BadRequestException('tahun lahir tidak valid');
    return this.db.withTenant(u.tenantId, async (c) => {
      const r = await c.query(
        'INSERT INTO child_profiles(tenant_id,parent_id,alias,birth_year,avatar_id) VALUES ($1,$2,$3,$4,$5) RETURNING *',
        [u.tenantId, u.sub, alias, year, b?.avatarId ?? null]);
      await c.query('INSERT INTO screen_time_policies(child_id,tenant_id) VALUES ($1,$2)', [r.rows[0].id, u.tenantId]);
      return toChild(r.rows[0]);
    });
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    requireParent(u);
    await this.db.withTenant(u.tenantId, async (c) => {
      await ownChild(c, u, id);
      await c.query('DELETE FROM gameplay_events WHERE child_id=$1', [id]);
      await c.query('DELETE FROM screen_time_policies WHERE child_id=$1', [id]);
      await c.query('DELETE FROM child_profiles WHERE id=$1', [id]); // hapus fisik (hak hapus)
      await c.query('INSERT INTO audit_log(tenant_id,actor_id,action,target) VALUES ($1,$2,$3,$4)', [u.tenantId, u.sub, 'child.delete', id]);
    });
  }

  @Get(':id/export')
  export(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    requireParent(u);
    return this.db.withTenant(u.tenantId, async (c) => {
      const child = await ownChild(c, u, id);
      const ev = await c.query('SELECT id,activity_id,content_version,type,payload,device_ts FROM gameplay_events WHERE child_id=$1 ORDER BY device_ts', [id]);
      return { child: toChild(child), events: ev.rows };
    });
  }

  @Get(':id/policy')
  policy(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.db.withTenant(u.tenantId, async (c) => {
      await ownChild(c, u, id);
      return toPolicy((await c.query('SELECT * FROM screen_time_policies WHERE child_id=$1', [id])).rows[0]);
    });
  }

  @Put(':id/policy')
  setPolicy(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() b: any) {
    requireParent(u);
    const d = Number(b?.dailyMinutes), s = Number(b?.sessionMinutes);
    if (!(d >= 5 && d <= 240) || !(s >= 3 && s <= 60)) throw new BadRequestException('durasi di luar batas');
    const time = (v: any) => (v == null ? null : /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : (() => { throw new BadRequestException('format jam HH:MM'); })());
    return this.db.withTenant(u.tenantId, async (c) => {
      await ownChild(c, u, id);
      const r = await c.query(
        `UPDATE screen_time_policies SET daily_minutes=$2, session_minutes=$3, allowed_from=$4, allowed_to=$5,
           version=version+1, updated_at=now() WHERE child_id=$1 RETURNING *`,
        [id, d, s, time(b?.allowedFrom), time(b?.allowedTo)]);
      return toPolicy(r.rows[0]);
    });
  }
}
