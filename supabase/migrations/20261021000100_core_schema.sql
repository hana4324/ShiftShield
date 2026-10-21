-- ShiftShield core schema: identities, officers, companies, sites, plans, settings.
-- Conventions: uuid PKs, created_at/updated_at everywhere, money in integer cents, timestamptz,
-- PostGIS geography(Point) behind the public.geo_point domain so tests can stub it.

-- pglite:skip-line
create domain public.geo_point as extensions.geography(point, 4326);

-- ---------- Enums ----------
create type public.app_role as enum ('officer', 'employer_owner', 'employer_manager', 'admin');
create type public.officer_account_status as enum ('onboarding', 'active', 'suspended', 'deactivated');
create type public.background_status as enum ('not_started', 'pending', 'clear', 'consider', 'failed');
create type public.license_status as enum ('pending', 'approved', 'rejected', 'expired', 'suspended');
create type public.company_type as enum ('security_company', 'senior_living', 'apartment', 'hospital', 'hotel', 'construction', 'corporate', 'event', 'retail', 'other');
create type public.site_type as enum ('senior_living', 'hospital', 'apartment', 'hotel', 'construction', 'corporate', 'event', 'retail', 'other');
create type public.subscription_status as enum ('none', 'trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid', 'paused');
create type public.plan_code as enum ('essential', 'pro', 'enterprise');
create type public.company_member_role as enum ('owner', 'manager');

-- ---------- Helpers ----------
create or replace function private.uid()
returns uuid
language sql
stable
as $$
  select auth.uid();
$$;

create or replace function private.jwt_claim(claim text)
returns text
language sql
stable
as $$
  select nullif(coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> claim, ''), '');
$$;

create or replace function private.jwt_company_id()
returns uuid
language sql
stable
as $$
  select nullif(private.jwt_claim('company_id'), '')::uuid;
$$;

create or replace function private.is_employer()
returns boolean
language sql
stable
as $$
  select private.jwt_role() in ('employer_owner', 'employer_manager');
$$;

create or replace function private.is_officer()
returns boolean
language sql
stable
as $$
  select private.jwt_role() = 'officer';
$$;

-- Security-definer functions mark the transaction as internal so the column guards (RLS migration) let them
-- change privileged columns. set_config(..., true) is transaction-local, so the flag never leaks.
create or replace function private.begin_internal()
returns void
language sql
as $$
  select set_config('shiftshield.internal', 'on', true);
$$;

create or replace function private.is_internal()
returns boolean
language sql
stable
as $$
  select coalesce(current_setting('shiftshield.internal', true), '') = 'on'
      or private.is_admin()
      or current_setting('role', true) = 'service_role'
      or auth.uid() is null;
$$;

-- ---------- Profiles ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null default 'officer',
  full_name text not null default '',
  phone text,
  email text,
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_set_updated_at before update on public.profiles for each row execute function private.set_updated_at();
comment on table public.profiles is 'One row per auth user. role is copied into the JWT by the custom access token hook.';

-- ---------- License types (per state, so other states can be added) ----------
create table public.license_types (
  id uuid primary key default gen_random_uuid(),
  state text not null,
  code text not null unique,
  name text not null,
  level integer not null check (level between 1 and 9),
  armed boolean not null default false,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger license_types_set_updated_at before update on public.license_types for each row execute function private.set_updated_at();

-- ---------- Officers ----------
create table public.officer_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  home_geo public.geo_point,
  home_city text,
  home_zip text,
  travel_radius_mi integer not null default 25 check (travel_radius_mi between 1 and 200),
  is_available boolean not null default true,
  is_18_plus boolean not null default false,
  is_21_plus boolean not null default false,
  signup_fee_paid_at timestamptz,
  signup_fee_checkout_session_id text,
  background_status public.background_status not null default 'not_started',
  background_provider text,
  background_reference text,
  background_updated_at timestamptz,
  account_status public.officer_account_status not null default 'onboarding',
  status_reason text,
  rating_avg numeric(3, 2) not null default 0,
  rating_count integer not null default 0,
  completed_shifts integer not null default 0,
  no_show_count integer not null default 0,
  late_cancel_count integer not null default 0,
  stripe_account_id text,
  payouts_enabled boolean not null default false,
  instant_payouts_enabled boolean not null default false,
  deactivated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger officer_profiles_set_updated_at before update on public.officer_profiles for each row execute function private.set_updated_at();
create index officer_profiles_available_idx on public.officer_profiles (is_available, account_status);

create table public.officer_licenses (
  id uuid primary key default gen_random_uuid(),
  officer_id uuid not null references public.officer_profiles (user_id) on delete cascade,
  license_type_id uuid not null references public.license_types (id),
  license_number text not null,
  expires_on date not null,
  front_path text not null,
  back_path text not null,
  status public.license_status not null default 'pending',
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  rejection_reason text,
  warned_30 boolean not null default false,
  warned_14 boolean not null default false,
  warned_3 boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger officer_licenses_set_updated_at before update on public.officer_licenses for each row execute function private.set_updated_at();
create index officer_licenses_officer_idx on public.officer_licenses (officer_id, status);
create index officer_licenses_review_queue_idx on public.officer_licenses (status, created_at) where status = 'pending';

create table public.officer_certifications (
  id uuid primary key default gen_random_uuid(),
  officer_id uuid not null references public.officer_profiles (user_id) on delete cascade,
  name text not null,
  issued_on date,
  expires_on date,
  document_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger officer_certifications_set_updated_at before update on public.officer_certifications for each row execute function private.set_updated_at();

-- ---------- Plans (defaults seeded; admin-editable) ----------
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code public.plan_code not null unique,
  name text not null,
  price_cents integer not null check (price_cents >= 0),
  monthly_booking_cap integer check (monthly_booking_cap is null or monthly_booking_cap > 0),
  monthly_shift_cap integer check (monthly_shift_cap is null or monthly_shift_cap > 0),
  min_lead_time_minutes integer not null default 0 check (min_lead_time_minutes >= 0),
  max_sites integer check (max_sites is null or max_sites > 0),
  max_seats integer check (max_seats is null or max_seats > 0),
  fee_bps integer not null check (fee_bps between 0 and 10000),
  daily_pay_enabled boolean not null default false,
  priority_rank integer not null default 0,
  features jsonb not null default '{}'::jsonb,
  stripe_price_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger plans_set_updated_at before update on public.plans for each row execute function private.set_updated_at();

-- ---------- Companies ----------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  dba text,
  type public.company_type not null default 'other',
  phone text,
  billing_email text,
  logo_path text,
  dps_license_no text,
  plan_id uuid references public.plans (id),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  subscription_status public.subscription_status not null default 'none',
  current_period_start timestamptz,
  current_period_end timestamptz,
  default_payment_method_id text,
  is_pilot boolean not null default false,
  pilot_ends_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger companies_set_updated_at before update on public.companies for each row execute function private.set_updated_at();

create table public.company_members (
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.company_member_role not null default 'manager',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, user_id)
);
create trigger company_members_set_updated_at before update on public.company_members for each row execute function private.set_updated_at();
-- A user belongs to at most one company in v1.
create unique index company_members_user_unique on public.company_members (user_id);

create table public.company_invites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  email text not null,
  role public.company_member_role not null default 'manager',
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  invited_by uuid references public.profiles (id),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger company_invites_set_updated_at before update on public.company_invites for each row execute function private.set_updated_at();
create index company_invites_email_idx on public.company_invites (lower(email));

-- ---------- Sites ----------
create table public.sites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  site_type public.site_type not null default 'other',
  address text not null,
  geo public.geo_point not null,
  geofence_radius_m integer not null default 150 check (geofence_radius_m between 25 and 2000),
  photo_path text,
  contact_name text,
  contact_phone text,
  post_orders text,
  timezone text not null default 'America/Chicago',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger sites_set_updated_at before update on public.sites for each row execute function private.set_updated_at();
create index sites_company_idx on public.sites (company_id);

-- ---------- Platform settings (admin-editable business rules) ----------
create table public.platform_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create or replace function private.setting_int(p_key text, p_default integer)
returns integer
language sql
stable
as $$
  select coalesce((select (value #>> '{}')::integer from public.platform_settings where key = p_key), p_default);
$$;

create or replace function private.setting_numeric(p_key text, p_default numeric)
returns numeric
language sql
stable
as $$
  select coalesce((select (value #>> '{}')::numeric from public.platform_settings where key = p_key), p_default);
$$;

-- ---------- Legal acceptance ----------
create table public.user_agreements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  doc_slug text not null,
  version text not null,
  accepted_at timestamptz not null default now(),
  ip_hash text,
  created_at timestamptz not null default now()
);
create index user_agreements_user_idx on public.user_agreements (user_id, doc_slug);

-- ---------- Audit log ----------
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  actor_role text,
  action text not null,
  entity_type text not null,
  entity_id text,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_entity_idx on public.audit_log (entity_type, entity_id, created_at desc);
create index audit_log_created_idx on public.audit_log (created_at desc);

create or replace function private.audit(p_action text, p_entity_type text, p_entity_id text, p_before jsonb, p_after jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, before, after)
  values (auth.uid(), private.jwt_role(), p_action, p_entity_type, p_entity_id, p_before, p_after);
$$;

-- ---------- Push tokens & notifications ----------
create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('ios', 'android', 'web')),
  device_name text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger push_tokens_set_updated_at before update on public.push_tokens for each row execute function private.set_updated_at();
create index push_tokens_user_idx on public.push_tokens (user_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- Outbox drained by the send-push Edge Function (pg_cron + pg_net call it every minute).
create table public.push_queue (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  channel text not null default 'push' check (channel in ('push', 'sms', 'email')),
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'skipped')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index push_queue_status_idx on public.push_queue (status, created_at) where status = 'queued';

-- Insert an in-app notification and queue the push in one call.
create or replace function private.notify(p_user_id uuid, p_kind text, p_title text, p_body text, p_data jsonb default '{}'::jsonb, p_channel text default 'push')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, kind, title, body, data) values (p_user_id, p_kind, p_title, p_body, coalesce(p_data, '{}'::jsonb));
  insert into public.push_queue (user_id, title, body, data, channel) values (p_user_id, p_title, p_body, coalesce(p_data, '{}'::jsonb) || jsonb_build_object('kind', p_kind), p_channel);
end;
$$;

-- Notify every member of a company.
create or replace function private.notify_company(p_company_id uuid, p_kind text, p_title text, p_body text, p_data jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m record;
begin
  for m in select user_id from public.company_members where company_id = p_company_id loop
    perform private.notify(m.user_id, p_kind, p_title, p_body, p_data);
  end loop;
end;
$$;

-- ---------- Grants ----------
-- The private schema is not exposed through PostgREST, but RLS policies and triggers run its helper
-- functions as the calling role, so API roles need usage + execute.
grant usage on schema private to anon, authenticated, service_role;
grant execute on all functions in schema private to anon, authenticated, service_role;
alter default privileges in schema private grant execute on functions to anon, authenticated, service_role;
