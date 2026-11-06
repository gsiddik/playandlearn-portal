-- Play & Learn — skema awal (Increment 0). Draft untuk review.
-- Prinsip: minimisasi data anak (tanpa nama lengkap/foto/lokasi), isolasi tenant via RLS.
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE tenants (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind        text NOT NULL CHECK (kind IN ('family','school','internal')),
  name        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  role        text NOT NULL CHECK (role IN ('parent','teacher','school_admin','ops_admin','content_designer','support')),
  email       text NOT NULL,
  password_hash text,              -- null bila memakai IdP eksternal
  created_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz,
  UNIQUE (email)
);

-- Persetujuan orang tua (verifiable parental consent) — dicatat, tidak dihapus.
CREATE TABLE parental_consents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  parent_id   uuid NOT NULL REFERENCES users(id),
  policy_version text NOT NULL,
  method      text NOT NULL,       -- metode verifikasi: ditentukan bersama penasihat hukum
  granted_at  timestamptz NOT NULL DEFAULT now(),
  revoked_at  timestamptz
);

-- Profil anak: minimum data. Tidak ada nama lengkap, foto, lokasi.
CREATE TABLE child_profiles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  parent_id   uuid NOT NULL REFERENCES users(id),
  pseudonym   uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE, -- ID yang dipakai di telemetri
  alias       text NOT NULL,       -- panggilan/nama samaran pilihan orang tua
  birth_year  smallint NOT NULL CHECK (birth_year BETWEEN 2010 AND 2100),
  avatar_id   text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

CREATE TABLE content_packs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version     integer NOT NULL,
  status      text NOT NULL CHECK (status IN ('draft','staging','published','retired')),
  min_age     smallint NOT NULL DEFAULT 4,
  max_age     smallint NOT NULL DEFAULT 7,
  manifest    jsonb NOT NULL,      -- daftar aktivitas, aset, pemetaan indikator kurikulum
  published_at timestamptz,
  UNIQUE (version)
);

CREATE TABLE screen_time_policies (
  child_id    uuid PRIMARY KEY REFERENCES child_profiles(id) ON DELETE CASCADE,
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  daily_minutes smallint NOT NULL DEFAULT 30 CHECK (daily_minutes BETWEEN 5 AND 240),
  session_minutes smallint NOT NULL DEFAULT 10 CHECK (session_minutes BETWEEN 3 AND 60),
  allowed_from time,
  allowed_to   time,
  version     integer NOT NULL DEFAULT 1,    -- server authority
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Event gameplay: append-only, ID dibuat klien (idempoten).
CREATE TABLE gameplay_events (
  id          uuid PRIMARY KEY,
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  child_id    uuid NOT NULL REFERENCES child_profiles(id),
  activity_id text NOT NULL,
  content_version integer NOT NULL,
  type        text NOT NULL,       -- mis. started, attempt, hint_shown, completed
  payload     jsonb NOT NULL DEFAULT '{}',
  device_ts   timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX gameplay_events_child_idx ON gameplay_events (child_id, device_ts);

CREATE TABLE audit_log (
  id          bigserial PRIMARY KEY,
  tenant_id   uuid,
  actor_id    uuid,
  action      text NOT NULL,
  target      text,
  at          timestamptz NOT NULL DEFAULT now()
);

-- Row-Level Security: setiap koneksi aplikasi harus SET app.tenant_id per request.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['users','parental_consents','child_profiles','screen_time_policies','gameplay_events']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON %I
      USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)$p$, t);
  END LOOP;
END $$;

COMMIT;
