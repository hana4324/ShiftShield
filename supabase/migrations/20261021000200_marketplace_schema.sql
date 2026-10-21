-- Marketplace: shifts, applications, assignments, location, payments, messaging, incidents,
-- ratings, strikes, disputes, saved shifts, Stripe idempotency.

create type public.shift_status as enum ('draft', 'open', 'filled', 'in_progress', 'completed', 'cancelled');
create type public.fill_mode as enum ('review', 'auto');
create type public.application_status as enum ('applied', 'accepted', 'declined', 'withdrawn');
create type public.assignment_status as enum ('confirmed', 'clocked_in', 'completed', 'no_show', 'cancelled_by_officer', 'cancelled_by_employer');
create type public.approval_status as enum ('pending', 'approved', 'disputed', 'auto_approved');
create type public.payment_status as enum ('pending', 'authorized', 'captured', 'failed', 'partially_refunded', 'refunded', 'paid_out', 'canceled');
create type public.rating_direction as enum ('employer_to_officer', 'officer_to_employer');
create type public.strike_type as enum ('no_show', 'late_cancel');
create type public.incident_type as enum ('medical', 'theft', 'trespass', 'altercation', 'property_damage', 'suspicious_activity', 'fire_safety', 'other');
create type public.dispute_status as enum ('open', 'resolved_full', 'resolved_adjusted', 'resolved_refund');

-- ---------- Shifts ----------
create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  site_id uuid not null references public.sites (id),
  title text not null,
  description text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  hourly_rate_cents integer not null check (hourly_rate_cents > 0),
  officers_needed integer not null default 1 check (officers_needed between 1 and 100),
  required_license_level integer not null default 2 check (required_license_level between 1 and 9),
  armed_required boolean not null default false,
  requirements jsonb not null default '[]'::jsonb,
  fill_mode public.fill_mode not null default 'review',
  is_urgent boolean not null default false,
  status public.shift_status not null default 'draft',
  created_by uuid references public.profiles (id),
  published_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  reminder_24h_sent boolean not null default false,
  reminder_2h_sent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shifts_window check (end_at > start_at and end_at - start_at <= interval '24 hours')
);
create trigger shifts_set_updated_at before update on public.shifts for each row execute function private.set_updated_at();
create index shifts_company_status_idx on public.shifts (company_id, status, start_at);
create index shifts_open_idx on public.shifts (start_at) where status = 'open';
create index shifts_site_idx on public.shifts (site_id);

-- ---------- Applications ----------
create table public.shift_applications (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts (id) on delete cascade,
  officer_id uuid not null references public.officer_profiles (user_id) on delete cascade,
  status public.application_status not null default 'applied',
  message text,
  decided_by uuid references public.profiles (id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shift_id, officer_id)
);
create trigger shift_applications_set_updated_at before update on public.shift_applications for each row execute function private.set_updated_at();
create index shift_applications_officer_idx on public.shift_applications (officer_id, status);
create index shift_applications_shift_idx on public.shift_applications (shift_id, status);

-- ---------- Assignments ----------
create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts (id) on delete cascade,
  officer_id uuid not null references public.officer_profiles (user_id),
  status public.assignment_status not null default 'confirmed',
  clock_in_at timestamptz,
  clock_in_geo public.geo_point,
  clock_in_accuracy_m numeric(8, 2),
  clock_in_override boolean not null default false,
  override_requested_at timestamptz,
  clock_out_at timestamptz,
  clock_out_geo public.geo_point,
  clock_out_accuracy_m numeric(8, 2),
  clock_out_notes text,
  approved_minutes integer check (approved_minutes is null or approved_minutes >= 0),
  approval_status public.approval_status not null default 'pending',
  approved_at timestamptz,
  approved_by uuid references public.profiles (id),
  cancelled_at timestamptz,
  cancel_reason text,
  no_show_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger assignments_set_updated_at before update on public.assignments for each row execute function private.set_updated_at();
-- One live booking per officer per shift (cancelled / no-show rows may be re-created).
create unique index assignments_active_unique on public.assignments (shift_id, officer_id)
  where status in ('confirmed', 'clocked_in', 'completed');
create index assignments_officer_idx on public.assignments (officer_id, status);
create index assignments_shift_idx on public.assignments (shift_id, status);
create index assignments_live_idx on public.assignments (status) where status = 'clocked_in';

-- ---------- Location pings (only while clocked in; pruned after 90 days) ----------
create table public.location_pings (
  id bigint generated always as identity primary key,
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  geo public.geo_point not null,
  accuracy_m numeric(8, 2),
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index location_pings_assignment_idx on public.location_pings (assignment_id, recorded_at desc);
create index location_pings_recorded_idx on public.location_pings (recorded_at);

-- ---------- Payments (one per assignment) ----------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null unique references public.assignments (id) on delete cascade,
  company_id uuid not null references public.companies (id),
  officer_id uuid not null references public.officer_profiles (user_id),
  officer_pay_cents integer not null check (officer_pay_cents >= 0),
  platform_fee_cents integer not null check (platform_fee_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  fee_bps integer not null,
  stripe_payment_intent_id text unique,
  stripe_charge_id text,
  stripe_transfer_id text,
  stripe_refund_id text,
  stripe_payout_id text,
  status public.payment_status not null default 'pending',
  refunded_cents integer not null default 0 check (refunded_cents >= 0),
  paid_out_cents integer not null default 0 check (paid_out_cents >= 0),
  failure_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger payments_set_updated_at before update on public.payments for each row execute function private.set_updated_at();
create index payments_company_idx on public.payments (company_id, created_at desc);
create index payments_officer_idx on public.payments (officer_id, created_at desc);

-- ---------- Ratings (two-way) ----------
create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  rater_id uuid not null references public.profiles (id),
  ratee_id uuid not null references public.profiles (id),
  direction public.rating_direction not null,
  stars integer not null check (stars between 1 and 5),
  tags text[] not null default '{}',
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, direction)
);
create trigger ratings_set_updated_at before update on public.ratings for each row execute function private.set_updated_at();
create index ratings_ratee_idx on public.ratings (ratee_id, direction);

-- ---------- Strikes ----------
create table public.strikes (
  id uuid primary key default gen_random_uuid(),
  officer_id uuid not null references public.officer_profiles (user_id) on delete cascade,
  assignment_id uuid references public.assignments (id) on delete set null,
  type public.strike_type not null,
  notes text,
  created_at timestamptz not null default now()
);
create index strikes_officer_idx on public.strikes (officer_id, created_at desc);

-- ---------- Disputes ----------
create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null unique references public.assignments (id) on delete cascade,
  opened_by uuid not null references public.profiles (id),
  reason text not null,
  employer_notes text,
  officer_notes text,
  status public.dispute_status not null default 'open',
  resolved_by uuid references public.profiles (id),
  resolved_at timestamptz,
  resolution_notes text,
  resolved_minutes integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger disputes_set_updated_at before update on public.disputes for each row execute function private.set_updated_at();
create index disputes_status_idx on public.disputes (status, created_at desc);

-- ---------- Incident reports ----------
create table public.incident_reports (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  shift_id uuid not null references public.shifts (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  officer_id uuid not null references public.officer_profiles (user_id),
  type public.incident_type not null,
  description text not null,
  occurred_at timestamptz not null default now(),
  geo public.geo_point,
  photo_paths text[] not null default '{}',
  acknowledged_by uuid references public.profiles (id),
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger incident_reports_set_updated_at before update on public.incident_reports for each row execute function private.set_updated_at();
create index incident_reports_company_idx on public.incident_reports (company_id, created_at desc);

-- ---------- Messaging (one thread per shift) ----------
create table public.message_threads (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null unique references public.shifts (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger message_threads_set_updated_at before update on public.message_threads for each row execute function private.set_updated_at();

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.message_threads (id) on delete cascade,
  sender_id uuid not null references public.profiles (id),
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index messages_thread_idx on public.messages (thread_id, created_at);

-- ---------- Saved shifts ----------
create table public.saved_shifts (
  officer_id uuid not null references public.officer_profiles (user_id) on delete cascade,
  shift_id uuid not null references public.shifts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (officer_id, shift_id)
);

-- ---------- Stripe webhook idempotency ----------
create table public.stripe_events (
  id text primary key,
  type text not null,
  payload jsonb,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ---------- Row-level helpers ----------

-- Officer can see the PUBLIC subset of an employer's data for a shift only when open or they are involved.
create or replace function private.officer_involved_in_shift(p_shift_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.assignments a
    where a.shift_id = p_shift_id and a.officer_id = auth.uid()
      and a.status in ('confirmed', 'clocked_in', 'completed')
  ) or exists (
    select 1 from public.shift_applications s
    where s.shift_id = p_shift_id and s.officer_id = auth.uid() and s.status in ('applied', 'accepted')
  );
$$;

-- Employer can see an officer's public profile only if that officer applied to or is booked on one of its shifts.
create or replace function private.company_can_view_officer(p_company_id uuid, p_officer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.shift_applications s
    join public.shifts sh on sh.id = s.shift_id
    where sh.company_id = p_company_id and s.officer_id = p_officer_id
  ) or exists (
    select 1 from public.assignments a
    join public.shifts sh on sh.id = a.shift_id
    where sh.company_id = p_company_id and a.officer_id = p_officer_id
  );
$$;

-- License facts are read through definer functions so employers see the level without any access to license rows.
create or replace function private.officer_license_level(p_officer_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(max(lt.level), 0)
  from public.officer_licenses ol
  join public.license_types lt on lt.id = ol.license_type_id
  where ol.officer_id = p_officer_id and ol.status = 'approved' and ol.expires_on >= current_date;
$$;

create or replace function private.officer_armed_approved(p_officer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.officer_licenses ol join public.license_types lt on lt.id = ol.license_type_id
    where ol.officer_id = p_officer_id and ol.status = 'approved' and ol.expires_on >= current_date and lt.armed);
$$;

-- Public officer card (no license images, no PII beyond name/photo). Employers read this instead of officer_profiles.
create or replace view public.officer_public_profiles
with (security_invoker = true)
as
select
  op.user_id,
  p.full_name,
  p.avatar_path,
  op.home_city,
  op.rating_avg,
  op.rating_count,
  op.completed_shifts,
  op.account_status,
  case when op.completed_shifts + op.no_show_count = 0 then 100
       else round(100.0 * op.completed_shifts / (op.completed_shifts + op.no_show_count))::integer end as reliability_pct,
  private.officer_license_level(op.user_id) as license_level,
  private.officer_armed_approved(op.user_id) as armed_approved
from public.officer_profiles op
join public.profiles p on p.id = op.user_id;
