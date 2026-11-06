# playandlearn-portal

Web Portal (Orang Tua, Sekolah/Guru, Operasional) dan Backend API untuk Play & Learn.

- Rencana: [docs/PLAN.md](docs/PLAN.md) · Privasi: [docs/PRIVACY.md](docs/PRIVACY.md)
- Kontrak API (sumber kebenaran untuk Android/iOS/Portal): [contracts/openapi.yaml](contracts/openapi.yaml)
- Skema DB: `db/migrations/`; uji isolasi tenant: `PGURL=... db/test_rls.sh`
- API: `apps/api` (NestJS, TypeScript). `npm ci && npm run build && npm test`
- Portal web (`apps/web`) dimulai pada Increment 1.

Status: Increment 0 (fondasi).
