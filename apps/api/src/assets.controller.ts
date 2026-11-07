import { BadRequestException, Body, Controller, ForbiddenException, Get, HttpCode, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { createHash } from 'crypto';
import type { Response } from 'express';
import { Db } from './db';
import { AuthGuard, AuthUser, CurrentUser } from './auth';
import { checkAsset } from './assets';

const OPS = ['ops_admin', 'content_designer'];
const ops = (u: AuthUser) => { if (!OPS.includes(u.role)) throw new ForbiddenException(); };
const PURPOSES = ['instruksi', 'umpan_balik', 'efek', 'ilustrasi', 'lainnya'];
const COLS = 'id, kind, purpose, name, language, transcript, mime, size_bytes AS "sizeBytes", recorded, status, created_at AS "createdAt"';

@Controller()
@UseGuards(AuthGuard)
export class AssetsController {
  constructor(private db: Db) {}

  /** Unggah berkas atau hasil rekaman browser (base64). Tipe diverifikasi dari isi berkas. */
  @Post('ops/assets')
  async upload(@CurrentUser() u: AuthUser, @Body() b: any) {
    ops(u);
    const name = String(b?.name ?? '').trim();
    if (!name || name.length > 100) throw new BadRequestException('nama wajib, maks 100 karakter');
    const purpose = PURPOSES.includes(b?.purpose) ? b.purpose : 'lainnya';
    if (typeof b?.dataBase64 !== 'string' || !/^[A-Za-z0-9+/=\s]+$/.test(b.dataBase64)) throw new BadRequestException('dataBase64 tidak valid');
    const data = Buffer.from(b.dataBase64, 'base64');
    const chk = checkAsset(b?.mime, data);
    if (typeof chk === 'string') throw new BadRequestException(chk);
    const r = await this.db.pool.query(
      `INSERT INTO assets(kind,purpose,name,language,transcript,mime,size_bytes,sha256,recorded,data,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING ${COLS}`,
      [chk.kind, purpose, name, b?.language ? String(b.language).slice(0, 8) : null, b?.transcript ? String(b.transcript).slice(0, 500) : null,
        chk.mime, data.length, createHash('sha256').update(data).digest('hex'), b?.recorded === true, data, u.sub]);
    await this.db.pool.query('INSERT INTO audit_log(tenant_id,actor_id,action,target) VALUES ($1,$2,$3,$4)', [u.tenantId, u.sub, 'asset.upload', r.rows[0].id]);
    return r.rows[0];
  }

  @Get('ops/assets')
  async list(@CurrentUser() u: AuthUser, @Query('kind') kind?: string, @Query('status') status = 'active') {
    ops(u);
    const r = await this.db.pool.query(
      `SELECT ${COLS} FROM assets WHERE status=$1 AND ($2::text IS NULL OR kind=$2) ORDER BY created_at DESC LIMIT 200`,
      [status === 'archived' ? 'archived' : 'active', kind === 'image' || kind === 'audio' ? kind : null]);
    return r.rows;
  }

  @Patch('ops/assets/:id')
  async update(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() b: any) {
    ops(u);
    const r = await this.db.pool.query(
      `UPDATE assets SET name=coalesce($2,name), purpose=coalesce($3,purpose), transcript=coalesce($4,transcript), status=coalesce($5,status)
        WHERE id=$1 RETURNING ${COLS}`,
      [id, b?.name ? String(b.name).slice(0, 100) : null, PURPOSES.includes(b?.purpose) ? b.purpose : null,
        b?.transcript != null ? String(b.transcript).slice(0, 500) : null, b?.status === 'archived' || b?.status === 'active' ? b.status : null]);
    if (!r.rowCount) throw new NotFoundException();
    return r.rows[0];
  }

  /** Berkas dilayani ke semua pengguna terautentikasi (aplikasi mengunduhnya bersama content pack). SVG disandbox. */
  @Get('assets/:id/file')
  @HttpCode(200)
  async file(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const r = await this.db.pool.query("SELECT mime, data, sha256 FROM assets WHERE id=$1 AND status='active'", [id]);
    if (!r.rowCount) throw new NotFoundException();
    const a = r.rows[0];
    res.set({
      'Content-Type': a.mime, 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "sandbox; default-src 'none'",
      'Cache-Control': 'private, max-age=31536000, immutable', ETag: `"${a.sha256}"`,
    });
    res.send(a.data);
  }
}
