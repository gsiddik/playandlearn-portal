import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, NotFoundException, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { Db } from './db';
import { AuthGuard, AuthUser, CurrentUser } from './auth';
import { validateManifest } from './manifest';

const OPS = ['ops_admin', 'content_designer'];
const ops = (u: AuthUser) => { if (!OPS.includes(u.role)) throw new ForbiddenException(); };
const opsAdmin = (u: AuthUser) => { if (u.role !== 'ops_admin') throw new ForbiddenException(); };

/** Portal Operasional: manajemen konten berversi. Konten terbit bersifat tidak dapat diubah (immutable); perubahan = versi baru. */
@Controller('ops')
@UseGuards(AuthGuard)
export class OpsController {
  constructor(private db: Db) {}

  private audit(u: AuthUser, action: string, target: string) {
    return this.db.pool.query('INSERT INTO audit_log(tenant_id,actor_id,action,target) VALUES ($1,$2,$3,$4)', [u.tenantId, u.sub, action, target]);
  }

  @Post('packs/validate')
  validate(@CurrentUser() u: AuthUser, @Body() b: any) {
    ops(u);
    const errors = validateManifest(b?.manifest);
    return { valid: errors.length === 0, errors };
  }

  @Get('packs')
  async list(@CurrentUser() u: AuthUser) {
    ops(u);
    const r = await this.db.pool.query(
      `SELECT version, status, min_age AS "minAge", max_age AS "maxAge", published_at AS "publishedAt",
              jsonb_array_length(manifest->'activities') AS "activityCount" FROM content_packs ORDER BY version DESC`);
    return r.rows;
  }

  @Get('packs/:version')
  async get(@CurrentUser() u: AuthUser, @Param('version', ParseIntPipe) version: number) {
    ops(u);
    const r = await this.db.pool.query('SELECT version, status, manifest FROM content_packs WHERE version=$1', [version]);
    if (!r.rowCount) throw new NotFoundException();
    return r.rows[0];
  }

  /** Simpan draf. Versi baru harus lebih besar dari semua versi; draf dengan versi sama boleh ditimpa. */
  @Post('packs')
  async saveDraft(@CurrentUser() u: AuthUser, @Body() b: any) {
    ops(u);
    const m = b?.manifest;
    const errors = validateManifest(m);
    if (errors.length) throw new BadRequestException({ message: 'manifest tidak valid', errors });
    const ex = (await this.db.pool.query('SELECT status FROM content_packs WHERE version=$1', [m.version])).rows[0];
    if (ex && ex.status !== 'draft') throw new ConflictException('versi ini sudah terbit/ditarik dan tidak dapat diubah; gunakan nomor versi baru');
    if (!ex) {
      const max = (await this.db.pool.query('SELECT coalesce(max(version),0) AS m FROM content_packs')).rows[0].m;
      if (m.version <= max) throw new ConflictException(`versi harus lebih besar dari versi terbaru (${max})`);
    }
    await this.db.pool.query(
      `INSERT INTO content_packs(version,status,min_age,max_age,manifest) VALUES ($1,'draft',$2,$3,$4)
       ON CONFLICT (version) DO UPDATE SET manifest=$4, min_age=$2, max_age=$3`, [m.version, m.minAge, m.maxAge, m]);
    await this.audit(u, 'pack.save_draft', String(m.version));
    return { version: m.version, status: 'draft' };
  }

  @Post('packs/:version/publish')
  async publish(@CurrentUser() u: AuthUser, @Param('version', ParseIntPipe) version: number) {
    opsAdmin(u);
    const r = await this.db.pool.query("SELECT manifest FROM content_packs WHERE version=$1 AND status='draft'", [version]);
    if (!r.rowCount) throw new NotFoundException('hanya draf yang dapat diterbitkan');
    const errors = validateManifest(r.rows[0].manifest);
    if (errors.length) throw new BadRequestException({ message: 'manifest tidak valid', errors });
    const refs: string[] = (r.rows[0].manifest.activities ?? []).map((a: any) => a.promptAudio).filter(Boolean);
    if (refs.length) {
      const found = await this.db.pool.query("SELECT id FROM assets WHERE id = ANY($1::uuid[]) AND status='active' AND kind='audio'", [refs]);
      const missing = refs.filter((x) => !found.rows.some((f: any) => f.id === x));
      if (missing.length) throw new BadRequestException({ message: 'aset audio tidak ditemukan/aktif', errors: missing.map((x) => `promptAudio ${x}`) });
    }
    await this.db.pool.query("UPDATE content_packs SET status='published', published_at=now() WHERE version=$1", [version]);
    await this.audit(u, 'pack.publish', String(version));
    return { version, status: 'published' };
  }

  @Post('packs/:version/retire')
  async retire(@CurrentUser() u: AuthUser, @Param('version', ParseIntPipe) version: number) {
    opsAdmin(u);
    const r = await this.db.pool.query("UPDATE content_packs SET status='retired' WHERE version=$1 AND status='published' RETURNING version", [version]);
    if (!r.rowCount) throw new NotFoundException('hanya versi terbit yang dapat ditarik');
    await this.audit(u, 'pack.retire', String(version));
    return { version, status: 'retired' };
  }

  @Get('schools')
  async schools(@CurrentUser() u: AuthUser) {
    opsAdmin(u);
    return (await this.db.pool.query('SELECT * FROM ops_school_stats()')).rows;
  }
}
