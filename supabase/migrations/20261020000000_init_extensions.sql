-- ShiftShield: base extensions and shared helpers.
-- Phase 0 only needs the waitlist table, but PostGIS and pg_cron are enabled now so later
-- migrations can rely on them.

-- pglite:skip-line
create extension if not exists "pgcrypto" with schema extensions;
-- pglite:skip-line
create extension if not exists "postgis" with schema extensions;
-- pglite:skip-line
create extension if not exists "pg_cron";

-- Keep helpers out of the public API surface.
create schema if not exists private;

-- updated_at trigger used by every table.
create or replace function private.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- JWT helpers (populated by the custom access token hook in Phase 2).
-- Until then they return null, so admin policies simply do not match.
create or replace function private.jwt_role()
returns text
language sql
stable
as $$
  select nullif(coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'app_role',
    ''
  ), '');
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
as $$
  select private.jwt_role() = 'admin';
$$;
