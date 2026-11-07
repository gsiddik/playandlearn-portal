# playandlearn-portal

Web Portal (Orang Tua, Sekolah/Guru, Operasional) dan Backend API untuk Play & Learn.

- Rencana: [docs/PLAN.md](docs/PLAN.md) · Privasi: [docs/PRIVACY.md](docs/PRIVACY.md)
- Kontrak API (sumber kebenaran untuk Android/iOS/Portal): [contracts/openapi.yaml](contracts/openapi.yaml)
- Skema DB: `db/migrations/`; uji isolasi tenant: `PGURL=... db/test_rls.sh`
- API: `apps/api` (NestJS, TypeScript). `npm ci && npm run build && npm test`
- Portal Orang Tua v1: `apps/web` (React + Vite): `npm run dev -w apps/web`.

Status: Increment 0 (fondasi).

## Menjalankan lokal
```
createdb pal && export DATABASE_URL=postgres://localhost/pal MIGRATE=1 JWT_SECRET=ganti-ini
export BOOTSTRAP_OPS_EMAIL=ops@contoh.id BOOTSTRAP_OPS_PASSWORD='min-10-karakter'   # akun ops_admin awal
npm ci && npm run build && npm start -w apps/api        # API di :3000
npm run dev -w apps/web                                 # portal di :5173
```
Masuk sebagai ops di portal untuk menyimpan dan menerbitkan content pack (mulai dari `content/packs/v1.json`, salin ke draf).
Catatan deploy: fungsi SECURITY DEFINER (`auth_lookup`, `student_*`, `ops_school_stats`) harus dimiliki peran BYPASSRLS/superuser.
