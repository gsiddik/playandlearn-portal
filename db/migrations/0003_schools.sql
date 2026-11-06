BEGIN;
-- Jalur sekolah/guru (Increment 4). Tenant sekolah memakai tenants.kind='school'.

CREATE TABLE school_consents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  granted_by  uuid NOT NULL REFERENCES users(id),
  policy_version text NOT NULL,
  method      text NOT NULL,       -- mis. 'school-attestation'; final menunggu penasihat hukum
  granted_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE classes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  name        text NOT NULL,
  created_by  uuid NOT NULL REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

-- Murid sekolah = child_profiles tanpa parent_id, dengan class_id dan kredensial kartu.
ALTER TABLE child_profiles
  ALTER COLUMN parent_id DROP NOT NULL,
  ADD COLUMN class_id uuid REFERENCES classes(id),
  ADD COLUMN login_code text UNIQUE,          -- isi Kode QR (acak 128 bit)
  ADD COLUMN pin_hash text,                   -- hash PIN gambar (3 gambar dari 9)
  ADD COLUMN failed_attempts smallint NOT NULL DEFAULT 0,
  ADD COLUMN locked_until timestamptz;

CREATE TABLE assignments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  class_id    uuid NOT NULL REFERENCES classes(id),
  activity_id text NOT NULL,
  assigned_by uuid NOT NULL REFERENCES users(id),
  due_date    date,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, activity_id)
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['school_consents','classes','assignments']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON %I
      USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)$p$, t);
  END LOOP;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON school_consents, classes, assignments TO app_user;

-- Login murid mencari kode QR lintas tenant. CATATAN DEPLOY: fungsi SECURITY DEFINER ini (dan auth_lookup)
-- harus dimiliki peran dengan BYPASSRLS/superuser agar dapat membaca lintas tenant.
CREATE FUNCTION student_lookup(p_code text)
RETURNS TABLE (id uuid, tenant_id uuid, pin_hash text, failed_attempts smallint, locked_until timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT id, tenant_id, pin_hash, failed_attempts, locked_until FROM child_profiles
   WHERE login_code = p_code AND deleted_at IS NULL AND class_id IS NOT NULL
$$;
CREATE FUNCTION student_login_fail(p_id uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE child_profiles SET failed_attempts = failed_attempts + 1,
    locked_until = CASE WHEN failed_attempts + 1 >= 5 THEN now() + interval '15 minutes' ELSE locked_until END
   WHERE id = p_id
$$;
CREATE FUNCTION student_login_ok(p_id uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE child_profiles SET failed_attempts = 0, locked_until = NULL WHERE id = p_id
$$;
REVOKE ALL ON FUNCTION student_lookup(text), student_login_fail(uuid), student_login_ok(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION student_lookup(text), student_login_fail(uuid), student_login_ok(uuid) TO app_user;
COMMIT;
