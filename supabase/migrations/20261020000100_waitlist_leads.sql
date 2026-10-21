-- Pilot waitlist leads captured by the landing page (Phase 0).
-- Writes happen only from the web server action using the service role key.
-- Admins (JWT app_role = 'admin') can read/update from the admin panel in later phases.

create type public.waitlist_kind as enum ('employer', 'officer');
create type public.waitlist_status as enum ('new', 'contacted', 'pilot', 'declined');

create table public.waitlist_leads (
  id uuid primary key default gen_random_uuid(),
  kind public.waitlist_kind not null,
  status public.waitlist_status not null default 'new',

  -- shared
  contact_name text not null,
  email text not null,
  phone text not null,
  city text not null,
  notes text,

  -- employer
  company_name text,
  title text,
  company_type text,
  site_count integer check (site_count is null or site_count >= 0),
  shifts_per_month integer check (shifts_per_month is null or shifts_per_month >= 0),
  shift_types text[] not null default '{}',
  coverage_timeline text,

  -- officer
  license_level text,

  -- attribution / anti-abuse (no raw IPs stored)
  source text,
  user_agent text,
  ip_hash text,
  utm jsonb,

  -- admin follow-up
  admin_notes text,
  contacted_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint waitlist_employer_fields check (
    kind <> 'employer' or (company_name is not null and company_type is not null)
  )
);

comment on table public.waitlist_leads is 'Pilot program and launch waitlist leads from the marketing site.';

create index waitlist_leads_created_at_idx on public.waitlist_leads (created_at desc);
create index waitlist_leads_kind_status_idx on public.waitlist_leads (kind, status);
create index waitlist_leads_email_idx on public.waitlist_leads (lower(email));

create trigger waitlist_leads_set_updated_at
  before update on public.waitlist_leads
  for each row execute function private.set_updated_at();

-- Row Level Security: no anon/authenticated access by default.
alter table public.waitlist_leads enable row level security;

-- The service role bypasses RLS, which is how the server action inserts.
-- Admins can read and update through the admin claim.
create policy "admins read waitlist leads"
  on public.waitlist_leads for select
  to authenticated
  using (private.is_admin());

create policy "admins update waitlist leads"
  on public.waitlist_leads for update
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- Belt and braces: make sure anon cannot do anything even if a policy is added later by mistake.
revoke all on public.waitlist_leads from anon;
