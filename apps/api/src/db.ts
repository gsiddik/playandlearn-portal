import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

@Injectable()
export class Db implements OnModuleDestroy {
  readonly pool = new Pool({ connectionString: process.env.DATABASE_URL });

  /** Menjalankan fn dalam transaksi dengan konteks tenant (RLS aktif sebagai app_user). */
  async withTenant<T>(tenantId: string, fn: (c: PoolClient) => Promise<T>): Promise<T> {
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      await c.query('SET LOCAL ROLE app_user');
      await c.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
      const r = await fn(c);
      await c.query('COMMIT');
      return r;
    } catch (e) {
      await c.query('ROLLBACK');
      throw e;
    } finally {
      c.release();
    }
  }

  async migrate(dir = join(__dirname, '../../../db/migrations')) {
    await this.pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY)');
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
      const done = await this.pool.query('SELECT 1 FROM schema_migrations WHERE name=$1', [f]);
      if (done.rowCount) continue;
      await this.pool.query(readFileSync(join(dir, f), 'utf8'));
      await this.pool.query('INSERT INTO schema_migrations(name) VALUES ($1)', [f]);
    }
  }

  /** Menerbitkan content pack dari berkas JSON (CLI/seed; belum ada CMS). */
  async publishPack(manifest: { version: number; minAge: number; maxAge: number }) {
    await this.pool.query(
      `INSERT INTO content_packs(version,status,min_age,max_age,manifest,published_at)
       VALUES ($1,'published',$2,$3,$4,now()) ON CONFLICT (version) DO UPDATE SET manifest=$4, status='published'`,
      [manifest.version, manifest.minAge, manifest.maxAge, manifest],
    );
  }

  /** Membuat akun ops_admin awal dari lingkungan (BOOTSTRAP_OPS_EMAIL/PASSWORD) bila belum ada. */
  async bootstrapOps(email = process.env.BOOTSTRAP_OPS_EMAIL, password = process.env.BOOTSTRAP_OPS_PASSWORD) {
    if (!email || !password || password.length < 10) return false;
    const { hashPassword } = await import('./auth');
    if ((await this.pool.query('SELECT 1 FROM auth_lookup($1)', [email])).rowCount) return false;
    let t = (await this.pool.query("SELECT id FROM tenants WHERE kind='internal' LIMIT 1")).rows[0]?.id;
    if (!t) t = (await this.pool.query("INSERT INTO tenants(kind,name) VALUES ('internal','Play & Learn Ops') RETURNING id")).rows[0].id;
    await this.withTenant(t, (c) => c.query("INSERT INTO users(tenant_id,role,email,password_hash) VALUES ($1,'ops_admin',$2,$3)", [t, email.toLowerCase(), '']).then(async () => {
      await c.query('UPDATE users SET password_hash=$1 WHERE email=$2', [await hashPassword(password), email.toLowerCase()]);
    }));
    return true;
  }

  onModuleDestroy() { return this.pool.end(); }
}
