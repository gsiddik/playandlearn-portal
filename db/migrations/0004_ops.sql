BEGIN;
-- Statistik sekolah lintas tenant untuk portal operasional: hanya angka agregat, tanpa data anak.
-- CATATAN DEPLOY: fungsi SECURITY DEFINER harus dimiliki peran BYPASSRLS/superuser.
CREATE FUNCTION ops_school_stats()
RETURNS TABLE (id uuid, name text, created_at timestamptz, teachers int, classes int, students int)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id, t.name, t.created_at,
         (SELECT count(*)::int FROM users u WHERE u.tenant_id = t.id AND u.role IN ('teacher','school_admin') AND u.deleted_at IS NULL),
         (SELECT count(*)::int FROM classes c WHERE c.tenant_id = t.id AND c.deleted_at IS NULL),
         (SELECT count(*)::int FROM child_profiles p WHERE p.tenant_id = t.id AND p.class_id IS NOT NULL AND p.deleted_at IS NULL)
    FROM tenants t WHERE t.kind = 'school' ORDER BY t.created_at DESC
$$;
REVOKE ALL ON FUNCTION ops_school_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ops_school_stats() TO app_user;
COMMIT;
