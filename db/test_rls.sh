#!/usr/bin/env bash
# Uji isolasi tenant: butuh PostgreSQL lokal. Pakai: PGURL=postgres://... ./db/test_rls.sh
set -euo pipefail
: "${PGURL:?set PGURL ke database kosong untuk uji}"
psql "$PGURL" -v ON_ERROR_STOP=1 -q -f "$(dirname "$0")/migrations/0001_init.sql"
psql "$PGURL" -v ON_ERROR_STOP=1 -q <<'SQL'
CREATE ROLE app_test NOLOGIN;
GRANT ALL ON ALL TABLES IN SCHEMA public TO app_test;
INSERT INTO tenants(id,kind,name) VALUES ('00000000-0000-0000-0000-00000000000a','family','A'),('00000000-0000-0000-0000-00000000000b','family','B');
INSERT INTO users(tenant_id,role,email) VALUES ('00000000-0000-0000-0000-00000000000a','parent','a@x.id'),('00000000-0000-0000-0000-00000000000b','parent','b@x.id');
SET ROLE app_test;
SET app.tenant_id = '00000000-0000-0000-0000-00000000000a';
DO $$ BEGIN
  IF (SELECT count(*) FROM users) <> 1 THEN RAISE EXCEPTION 'RLS gagal: tenant A melihat % baris', (SELECT count(*) FROM users); END IF;
END $$;
RESET app.tenant_id;
DO $$ BEGIN
  IF (SELECT count(*) FROM users) <> 0 THEN RAISE EXCEPTION 'RLS gagal: tanpa tenant harus 0 baris'; END IF;
END $$;
SQL
echo "RLS OK"
