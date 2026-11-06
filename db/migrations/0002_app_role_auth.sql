BEGIN;
-- Peran aplikasi tanpa BYPASSRLS; koneksi aplikasi melakukan SET LOCAL ROLE app_user per transaksi.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN CREATE ROLE app_user NOLOGIN; END IF;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Login mencari email lintas tenant (sebelum tenant diketahui): hanya lewat fungsi ini.
CREATE FUNCTION auth_lookup(p_email text)
RETURNS TABLE (id uuid, tenant_id uuid, role text, password_hash text)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT id, tenant_id, role, password_hash FROM users WHERE email = lower(p_email) AND deleted_at IS NULL
$$;
REVOKE ALL ON FUNCTION auth_lookup(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_lookup(text) TO app_user;
COMMIT;
