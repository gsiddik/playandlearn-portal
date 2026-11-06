import { BadRequestException, Body, ConflictException, Controller, HttpCode, Post, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Db } from './db';
import { hashPassword, issueTokens, verifyPassword } from './auth';

const CURRENT_POLICY = '2026-11-draft'; // versi kebijakan privasi; final setelah review hukum

@Controller('auth')
export class AuthController {
  constructor(private db: Db) {}

  @Post('parents/register')
  async register(@Body() b: any) {
    const email = String(b?.email ?? '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new BadRequestException('email tidak valid');
    if (typeof b?.password !== 'string' || b.password.length < 10) throw new BadRequestException('password minimal 10 karakter');
    if (b?.consentGranted !== true || !b?.consentPolicyVersion) throw new BadRequestException('persetujuan orang tua wajib');
    const existing = await this.db.pool.query('SELECT 1 FROM auth_lookup($1)', [email]);
    if (existing.rowCount) throw new ConflictException('email sudah terdaftar');

    const tenantId = randomUUID();
    const userId = randomUUID();
    const hash = await hashPassword(b.password);
    await this.db.pool.query("INSERT INTO tenants(id,kind,name) VALUES ($1,'family',$2)", [tenantId, 'keluarga']);
    await this.db.withTenant(tenantId, async (c) => {
      await c.query("INSERT INTO users(id,tenant_id,role,email,password_hash) VALUES ($1,$2,'parent',$3,$4)", [userId, tenantId, email, hash]);
      await c.query(
        'INSERT INTO parental_consents(tenant_id,parent_id,policy_version,method) VALUES ($1,$2,$3,$4)',
        [tenantId, userId, String(b.consentPolicyVersion || CURRENT_POLICY), 'checkbox-akun'], // metode final: tunggu penasihat hukum
      );
    });
    return issueTokens({ sub: userId, tenantId, role: 'parent' });
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() b: any) {
    const r = await this.db.pool.query('SELECT * FROM auth_lookup($1)', [String(b?.email ?? '')]);
    const u = r.rows[0];
    if (!u || !u.password_hash || !(await verifyPassword(String(b?.password ?? ''), u.password_hash)))
      throw new UnauthorizedException('email atau password salah');
    return issueTokens({ sub: u.id, tenantId: u.tenant_id, role: u.role });
  }
}
