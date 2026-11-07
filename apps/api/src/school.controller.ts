import { BadRequestException, Body, ConflictException, Controller, Delete, ForbiddenException, Get, HttpCode, NotFoundException, Param, ParseUUIDPipe, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { randomBytes, randomInt, randomUUID } from 'crypto';
import { PoolClient } from 'pg';
import { Db } from './db';
import { gradeActivity, RULES } from './gradebook';
import { AuthGuard, AuthUser, CurrentUser, hashPassword, issueTokens, verifyPassword } from './auth';

const SCHOOL_POLICY = '2026-11-draft-school';
const STAFF = ['teacher', 'school_admin'];
const staff = (u: AuthUser) => { if (!STAFF.includes(u.role)) throw new ForbiddenException(); };
const admin = (u: AuthUser) => { if (u.role !== 'school_admin') throw new ForbiddenException(); };
const newPin = () => [randomInt(0, 9), randomInt(0, 9), randomInt(0, 9)]; // indeks 3 gambar dari 9

async function ownClass(c: PoolClient, id: string) {
  const r = await c.query('SELECT * FROM classes WHERE id=$1 AND deleted_at IS NULL', [id]);
  if (!r.rowCount) throw new NotFoundException();
  return r.rows[0];
}

@Controller()
export class SchoolController {
  constructor(private db: Db) {}

  /** Pendaftaran sekolah: pendaftar menjadi school_admin dan mengakui dasar persetujuan orang tua murid. */
  @Post('auth/schools/register')
  async registerSchool(@Body() b: any) {
    const email = String(b?.email ?? '').trim().toLowerCase();
    const name = String(b?.schoolName ?? '').trim();
    if (!name || name.length > 100) throw new BadRequestException('nama sekolah wajib');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new BadRequestException('email tidak valid');
    if (typeof b?.password !== 'string' || b.password.length < 10) throw new BadRequestException('password minimal 10 karakter');
    if (b?.parentalConsentAttested !== true) throw new BadRequestException('sekolah wajib menyatakan dasar persetujuan orang tua murid');
    if ((await this.db.pool.query('SELECT 1 FROM auth_lookup($1)', [email])).rowCount) throw new ConflictException('email sudah terdaftar');
    const tenantId = randomUUID(), userId = randomUUID();
    const hash = await hashPassword(b.password);
    await this.db.pool.query("INSERT INTO tenants(id,kind,name) VALUES ($1,'school',$2)", [tenantId, name]);
    await this.db.withTenant(tenantId, async (c) => {
      await c.query("INSERT INTO users(id,tenant_id,role,email,password_hash) VALUES ($1,$2,'school_admin',$3,$4)", [userId, tenantId, email, hash]);
      await c.query('INSERT INTO school_consents(tenant_id,granted_by,policy_version,method) VALUES ($1,$2,$3,$4)', [tenantId, userId, SCHOOL_POLICY, 'school-attestation']);
    });
    return issueTokens({ sub: userId, tenantId, role: 'school_admin' });
  }

  @Post('school/teachers')
  @UseGuards(AuthGuard)
  async addTeacher(@CurrentUser() u: AuthUser, @Body() b: any) {
    admin(u);
    const email = String(b?.email ?? '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || typeof b?.password !== 'string' || b.password.length < 10) throw new BadRequestException('email/password tidak valid');
    if ((await this.db.pool.query('SELECT 1 FROM auth_lookup($1)', [email])).rowCount) throw new ConflictException('email sudah terdaftar');
    const hash = await hashPassword(b.password);
    return this.db.withTenant(u.tenantId, async (c) => {
      const r = await c.query("INSERT INTO users(tenant_id,role,email,password_hash) VALUES ($1,'teacher',$2,$3) RETURNING id", [u.tenantId, email, hash]);
      return { id: r.rows[0].id, email };
    });
  }

  @Post('classes')
  @UseGuards(AuthGuard)
  createClass(@CurrentUser() u: AuthUser, @Body() b: any) {
    staff(u);
    const name = String(b?.name ?? '').trim();
    if (!name || name.length > 50) throw new BadRequestException('nama kelas wajib, maks 50 karakter');
    return this.db.withTenant(u.tenantId, async (c) =>
      (await c.query('INSERT INTO classes(tenant_id,name,created_by) VALUES ($1,$2,$3) RETURNING id,name', [u.tenantId, name, u.sub])).rows[0]);
  }

  @Get('classes')
  @UseGuards(AuthGuard)
  listClasses(@CurrentUser() u: AuthUser) {
    staff(u);
    return this.db.withTenant(u.tenantId, async (c) =>
      (await c.query('SELECT id,name FROM classes WHERE deleted_at IS NULL ORDER BY created_at')).rows);
  }

  /** Tambah murid; kredensial kartu (kode QR + PIN gambar) hanya ditampilkan SEKALI di respons ini. */
  @Post('classes/:id/students')
  @UseGuards(AuthGuard)
  addStudent(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() b: any) {
    staff(u);
    const alias = String(b?.alias ?? '').trim();
    const year = Number(b?.birthYear);
    if (!alias || alias.length > 30) throw new BadRequestException('alias wajib, maks 30 karakter');
    if (!Number.isInteger(year) || year < 2010 || year > new Date().getFullYear()) throw new BadRequestException('tahun lahir tidak valid');
    return this.db.withTenant(u.tenantId, async (c) => {
      await ownClass(c, id);
      if (!(await c.query('SELECT 1 FROM school_consents LIMIT 1')).rowCount) throw new ForbiddenException('dasar persetujuan orang tua belum tercatat');
      const pin = newPin();
      const code = randomBytes(16).toString('base64url');
      const r = await c.query(
        'INSERT INTO child_profiles(tenant_id,class_id,alias,birth_year,login_code,pin_hash) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
        [u.tenantId, id, alias, year, code, await hashPassword(pin.join(''))]);
      await c.query('INSERT INTO screen_time_policies(child_id,tenant_id) VALUES ($1,$2)', [r.rows[0].id, u.tenantId]);
      return { id: r.rows[0].id, alias, birthYear: year, loginCode: code, pin };
    });
  }

  @Get('classes/:id/students')
  @UseGuards(AuthGuard)
  listStudents(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    staff(u);
    return this.db.withTenant(u.tenantId, async (c) => {
      await ownClass(c, id);
      return (await c.query('SELECT id, alias, birth_year AS "birthYear" FROM child_profiles WHERE class_id=$1 AND deleted_at IS NULL ORDER BY alias', [id])).rows;
    });
  }

  @Post('students/:id/reset-pin')
  @UseGuards(AuthGuard)
  @HttpCode(200)
  resetPin(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    staff(u);
    return this.db.withTenant(u.tenantId, async (c) => {
      const pin = newPin();
      const code = randomBytes(16).toString('base64url'); // kode lama dicabut
      const r = await c.query(
        'UPDATE child_profiles SET login_code=$2, pin_hash=$3, failed_attempts=0, locked_until=NULL WHERE id=$1 AND class_id IS NOT NULL AND deleted_at IS NULL RETURNING alias',
        [id, code, await hashPassword(pin.join(''))]);
      if (!r.rowCount) throw new NotFoundException();
      return { id, alias: r.rows[0].alias, loginCode: code, pin };
    });
  }

  @Delete('students/:id')
  @UseGuards(AuthGuard)
  @HttpCode(204)
  async removeStudent(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    admin(u);
    await this.db.withTenant(u.tenantId, async (c) => {
      const r = await c.query('SELECT 1 FROM child_profiles WHERE id=$1 AND class_id IS NOT NULL', [id]);
      if (!r.rowCount) throw new NotFoundException();
      await c.query('DELETE FROM gameplay_events WHERE child_id=$1', [id]);
      await c.query('DELETE FROM screen_time_policies WHERE child_id=$1', [id]);
      await c.query('DELETE FROM child_profiles WHERE id=$1', [id]);
      await c.query('INSERT INTO audit_log(tenant_id,actor_id,action,target) VALUES ($1,$2,$3,$4)', [u.tenantId, u.sub, 'student.delete', id]);
    });
  }

  @Post('classes/:id/assignments')
  @UseGuards(AuthGuard)
  assign(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() b: any) {
    staff(u);
    const act = String(b?.activityId ?? '');
    if (!act) throw new BadRequestException('activityId wajib');
    const due = b?.dueDate ?? null;
    if (due !== null && !/^\d{4}-\d{2}-\d{2}$/.test(due)) throw new BadRequestException('dueDate YYYY-MM-DD');
    return this.db.withTenant(u.tenantId, async (c) => {
      await ownClass(c, id);
      const ok = await this.db.pool.query("SELECT 1 FROM content_packs WHERE status='published' AND manifest->'activities' @> $1::jsonb", [JSON.stringify([{ id: act }])]);
      if (!ok.rowCount) throw new BadRequestException('aktivitas tidak ada di konten terbit');
      const r = await c.query(
        `INSERT INTO assignments(tenant_id,class_id,activity_id,assigned_by,due_date) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (class_id,activity_id) DO UPDATE SET due_date=EXCLUDED.due_date RETURNING id, activity_id AS "activityId", due_date AS "dueDate"`,
        [u.tenantId, id, act, u.sub, due]);
      return r.rows[0];
    });
  }

  @Get('classes/:id/assignments')
  @UseGuards(AuthGuard)
  listAssignments(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    staff(u);
    return this.db.withTenant(u.tenantId, async (c) => {
      await ownClass(c, id);
      return (await c.query('SELECT id, activity_id AS "activityId", due_date AS "dueDate" FROM assignments WHERE class_id=$1 ORDER BY created_at', [id])).rows;
    });
  }

  @Delete('classes/:id/assignments/:aid')
  @UseGuards(AuthGuard)
  @HttpCode(204)
  async unassign(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Param('aid', ParseUUIDPipe) aid: string) {
    staff(u);
    await this.db.withTenant(u.tenantId, async (c) => { await ownClass(c, id); await c.query('DELETE FROM assignments WHERE id=$1 AND class_id=$2', [aid, id]); });
  }

  /** Hasil kelas: agregat bermain per murid per aktivitas. Deskriptif, bukan penilaian/diagnosis. */
  @Get('classes/:id/results')
  @UseGuards(AuthGuard)
  results(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    staff(u);
    return this.db.withTenant(u.tenantId, async (c) => {
      await ownClass(c, id);
      const r = await c.query(
        `SELECT p.id AS "studentId", p.alias, e.activity_id AS "activityId",
                count(*) FILTER (WHERE e.type='completed')::int AS completed,
                count(*) FILTER (WHERE e.type='hint_shown')::int AS hints,
                max(e.device_ts) AS "lastPlayed"
           FROM child_profiles p LEFT JOIN gameplay_events e ON e.child_id = p.id
          WHERE p.class_id=$1 AND p.deleted_at IS NULL GROUP BY p.id, p.alias, e.activity_id ORDER BY p.alias`, [id]);
      const byStudent = new Map<string, any>();
      for (const x of r.rows) {
        const s = byStudent.get(x.studentId) ?? { studentId: x.studentId, alias: x.alias, activities: [] };
        if (x.activityId) s.activities.push({ activityId: x.activityId, completed: x.completed, hints: x.hints, lastPlayed: x.lastPlayed });
        byStudent.set(x.studentId, s);
      }
      return { students: [...byStudent.values()] };
    });
  }

  /** Buku nilai deskriptif kelas: status per murid per aktivitas + kaitan indikator kurikulum dari content pack. */
  @Get('classes/:id/gradebook')
  @UseGuards(AuthGuard)
  gradebook(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    staff(u);
    return this.db.withTenant(u.tenantId, async (c) => {
      await ownClass(c, id);
      const pack = (await this.db.pool.query("SELECT version, manifest FROM content_packs WHERE status='published' ORDER BY version DESC LIMIT 1")).rows[0];
      const acts: any[] = pack?.manifest?.activities ?? [];
      const students = (await c.query('SELECT id, alias FROM child_profiles WHERE class_id=$1 AND deleted_at IS NULL ORDER BY alias', [id])).rows;
      const events = (await c.query(
        `SELECT child_id, activity_id, type, payload FROM gameplay_events
          WHERE child_id = ANY($1::uuid[])`, [students.map((s: any) => s.id)])).rows;
      return {
        contentVersion: pack?.version ?? null,
        rules: RULES,
        activities: acts.map((a) => ({ activityId: a.id, curriculum: a.curriculum ?? [], areas: a.areas ?? [] })),
        students: students.map((s: any) => ({
          studentId: s.id, alias: s.alias,
          grades: acts.map((a) => ({
            activityId: a.id,
            ...gradeActivity(events.filter((e: any) => e.child_id === s.id && e.activity_id === a.id), (a.levels ?? []).length),
          })),
        })),
      };
    });
  }

  // ---- murid ----

  @Post('auth/students/login')
  @HttpCode(200)
  async studentLogin(@Body() b: any) {
    const code = String(b?.loginCode ?? '');
    const pin = Array.isArray(b?.pin) ? b.pin : [];
    if (!code || pin.length !== 3 || !pin.every((n: any) => Number.isInteger(n) && n >= 0 && n <= 8)) throw new BadRequestException('data login tidak valid');
    const s = (await this.db.pool.query('SELECT * FROM student_lookup($1)', [code])).rows[0];
    if (!s) throw new UnauthorizedException();
    if (s.locked_until && new Date(s.locked_until) > new Date()) throw new HttpLocked();
    if (!(await verifyPassword(pin.join(''), s.pin_hash))) {
      await this.db.pool.query('SELECT student_login_fail($1)', [s.id]);
      throw new UnauthorizedException();
    }
    await this.db.pool.query('SELECT student_login_ok($1)', [s.id]);
    return issueTokens({ sub: s.id, tenantId: s.tenant_id, role: 'student' });
  }

  @Get('me/profile')
  @UseGuards(AuthGuard)
  async me(@CurrentUser() u: AuthUser) {
    if (u.role !== 'student') throw new ForbiddenException();
    return this.db.withTenant(u.tenantId, async (c) => {
      const p = (await c.query('SELECT id, alias, birth_year AS "birthYear", class_id FROM child_profiles WHERE id=$1 AND deleted_at IS NULL', [u.sub])).rows[0];
      if (!p) throw new NotFoundException();
      const a = (await c.query('SELECT activity_id AS "activityId", due_date AS "dueDate" FROM assignments WHERE class_id=$1 ORDER BY created_at', [p.class_id])).rows;
      return { id: p.id, alias: p.alias, birthYear: p.birthYear, assignments: a };
    });
  }
}

import { HttpException, HttpStatus } from '@nestjs/common';
class HttpLocked extends HttpException { constructor() { super('terkunci sementara', 423); } }
