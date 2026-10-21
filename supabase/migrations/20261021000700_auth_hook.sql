-- Auth integration:
--  1. New auth.users rows get a profiles row (role from signup metadata; admin can never be self-assigned).
--  2. Custom access token hook copies app_role and company_id into the JWT for RLS.
--     Enable it in the dashboard: Authentication > Hooks > Customize Access Token > public.custom_access_token_hook

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested text := coalesce(new.raw_user_meta_data ->> 'role', 'officer');
  r public.app_role;
begin
  r := case when requested in ('employer_owner', 'employer') then 'employer_owner'::public.app_role else 'officer'::public.app_role end;
  insert into public.profiles (id, role, full_name, phone, email)
  values (new.id, r, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.raw_user_meta_data ->> 'phone', new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- pglite:skip-line
create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_user();

-- Keep profiles.email in sync.
create or replace function private.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set email = new.email where id = new.id and email is distinct from new.email;
  return new;
end;
$$;

-- pglite:skip-line
create trigger on_auth_user_email_updated after update of email on auth.users for each row execute function private.handle_user_email_change();

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  claims jsonb := coalesce(event -> 'claims', '{}'::jsonb);
  uid uuid := (event ->> 'user_id')::uuid;
  r public.app_role;
  cid uuid;
  officer_status text;
begin
  select p.role into r from public.profiles p where p.id = uid;
  select cm.company_id into cid from public.company_members cm where cm.user_id = uid limit 1;
  select op.account_status::text into officer_status from public.officer_profiles op where op.user_id = uid;
  claims := claims || jsonb_build_object(
    'app_role', coalesce(r::text, 'officer'),
    'company_id', cid,
    'officer_status', officer_status
  );
  return jsonb_set(event, '{claims}', claims);
end;
$$;

-- pglite:skip-line
grant usage on schema public to supabase_auth_admin;
-- pglite:skip-line
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
-- pglite:skip-line
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;
-- pglite:skip-line
grant select on public.profiles, public.company_members, public.officer_profiles to supabase_auth_admin;

-- The hook runs as supabase_auth_admin, which must bypass RLS on the three tables it reads.
-- pglite:skip-line
create policy "auth admin reads profiles" on public.profiles for select to supabase_auth_admin using (true);
-- pglite:skip-line
create policy "auth admin reads members" on public.company_members for select to supabase_auth_admin using (true);
-- pglite:skip-line
create policy "auth admin reads officers" on public.officer_profiles for select to supabase_auth_admin using (true);

-- Realtime: employers subscribe to live pings and messages; publication must include the tables.
-- pglite:skip-line
alter publication supabase_realtime add table public.location_pings, public.messages, public.assignments, public.notifications;
