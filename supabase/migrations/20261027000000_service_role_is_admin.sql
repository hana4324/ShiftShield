-- The web app's ADMIN_OPEN_ACCESS mode (demo / pilot) reads and writes through the
-- service-role client instead of an admin's own session. The service role already bypasses
-- RLS, and several functions already treat it as admin-equivalent; make private.is_admin()
-- consistent with that so admin_* RPCs (admin_overview, admin_review_license, ...) accept it.
create or replace function private.is_admin()
returns boolean
language sql
stable
as $$
  select private.jwt_role() = 'admin' or current_setting('role', true) = 'service_role';
$$;
