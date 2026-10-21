-- Money and state changes live here (security definer, explicit auth checks, row locks).
-- Clients call these via supabase.rpc(); Edge Functions call them with the user's JWT, then talk to Stripe.

-- ---------- Eligibility ----------

-- Why an officer cannot accept shifts right now; empty array = eligible.
create or replace function private.officer_blockers_for(p_officer_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  op public.officer_profiles%rowtype;
  blockers text[] := '{}';
  has_license boolean;
begin
  if p_officer_id is null then return array['no_profile']; end if;
  select * into op from public.officer_profiles where user_id = p_officer_id;
  if not found then return array['no_profile']; end if;
  if op.signup_fee_paid_at is null then blockers := array_append(blockers, 'signup_fee'); end if;
  if op.background_status <> 'clear' then blockers := array_append(blockers, 'background_check'); end if;
  select exists (
    select 1 from public.officer_licenses l where l.officer_id = p_officer_id and l.status = 'approved' and l.expires_on >= current_date
  ) into has_license;
  if not has_license then blockers := array_append(blockers, 'license'); end if;
  if op.account_status in ('suspended', 'deactivated') then blockers := array_append(blockers, op.account_status::text); end if;
  return blockers;
end;
$$;

-- Public wrapper: an officer may only ask about themselves; admins and service role may ask about anyone.
create or replace function public.officer_blockers(p_officer_id uuid default auth.uid())
returns text[]
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_officer_id is null or (p_officer_id <> auth.uid() and not private.is_admin() and current_setting('role', true) <> 'service_role') then
    return array['not_authorized'];
  end if;
  return private.officer_blockers_for(p_officer_id);
end;
$$;

create or replace function private.officer_has_overlap(p_officer_id uuid, p_start timestamptz, p_end timestamptz, p_exclude_shift uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.assignments a
    join public.shifts sh on sh.id = a.shift_id
    where a.officer_id = p_officer_id
      and a.status in ('confirmed', 'clocked_in')
      and (p_exclude_shift is null or sh.id <> p_exclude_shift)
      and sh.start_at < p_end and sh.end_at > p_start
  );
$$;

-- ---------- Company plan + usage ----------

create or replace function private.company_plan(p_company_id uuid)
returns public.plans
language sql
stable
security definer
set search_path = public
as $$
  select p.* from public.companies c join public.plans p on p.id = c.plan_id where c.id = p_company_id;
$$;

-- Period = Stripe billing period when known, otherwise the calendar month.
create or replace function private.company_period(p_company_id uuid, out period_start timestamptz, out period_end timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c public.companies%rowtype;
begin
  select * into c from public.companies where id = p_company_id;
  if c.current_period_start is not null and c.current_period_end is not null and now() < c.current_period_end then
    period_start := c.current_period_start;
    period_end := c.current_period_end;
  else
    period_start := date_trunc('month', now());
    period_end := period_start + interval '1 month';
  end if;
end;
$$;

create or replace function public.company_usage(p_company_id uuid default private.jwt_company_id())
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  pl public.plans;
  ps timestamptz;
  pe timestamptz;
  bookings integer;
  shifts_posted integer;
  site_count integer;
  seat_count integer;
begin
  if p_company_id is null or (p_company_id <> private.jwt_company_id() and not private.is_admin()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  pl := private.company_plan(p_company_id);
  select * into ps, pe from private.company_period(p_company_id);
  select count(*) into bookings from public.assignments a join public.shifts sh on sh.id = a.shift_id
    where sh.company_id = p_company_id and a.status in ('confirmed', 'clocked_in', 'completed') and a.created_at >= ps and a.created_at < pe;
  select count(*) into shifts_posted from public.shifts where company_id = p_company_id and published_at >= ps and published_at < pe;
  select count(*) into site_count from public.sites where company_id = p_company_id and is_active;
  select count(*) into seat_count from public.company_members where company_id = p_company_id;
  return jsonb_build_object(
    'plan_code', pl.code, 'plan_name', pl.name,
    'period_start', ps, 'period_end', pe,
    'bookings_used', bookings, 'booking_cap', pl.monthly_booking_cap,
    'shifts_used', shifts_posted, 'shift_cap', pl.monthly_shift_cap,
    'sites_used', site_count, 'site_cap', pl.max_sites,
    'seats_used', seat_count, 'seat_cap', pl.max_seats,
    'min_lead_time_minutes', pl.min_lead_time_minutes,
    'fee_bps', pl.fee_bps, 'daily_pay_enabled', pl.daily_pay_enabled
  );
end;
$$;

-- Raises a structured error the apps turn into an upgrade prompt.
create or replace function private.require_plan_capacity(p_company_id uuid, p_check text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  u jsonb;
  c public.companies%rowtype;
begin
  select * into c from public.companies where id = p_company_id;
  if c.plan_id is null or c.subscription_status not in ('trialing', 'active', 'past_due') then
    raise exception 'subscription_required' using errcode = 'P0001', detail = 'Choose a plan to post shifts.';
  end if;
  u := public.company_usage(p_company_id);
  if p_check = 'shift' and (u ->> 'shift_cap') is not null and (u ->> 'shifts_used')::int >= (u ->> 'shift_cap')::int then
    raise exception 'plan_cap_shifts' using errcode = 'P0001', detail = format('Your %s plan allows %s posted shifts per month. Upgrade to post more.', u ->> 'plan_name', u ->> 'shift_cap');
  end if;
  if p_check = 'booking' and (u ->> 'booking_cap') is not null and (u ->> 'bookings_used')::int >= (u ->> 'booking_cap')::int then
    raise exception 'plan_cap_bookings' using errcode = 'P0001', detail = format('Your %s plan allows %s officer bookings per month. Upgrade to book more.', u ->> 'plan_name', u ->> 'booking_cap');
  end if;
  if p_check = 'site' and (u ->> 'site_cap') is not null and (u ->> 'sites_used')::int >= (u ->> 'site_cap')::int then
    raise exception 'plan_cap_sites' using errcode = 'P0001', detail = format('Your %s plan allows %s sites. Upgrade to add more.', u ->> 'plan_name', u ->> 'site_cap');
  end if;
  if p_check = 'seat' and (u ->> 'seat_cap') is not null and (u ->> 'seats_used')::int >= (u ->> 'seat_cap')::int then
    raise exception 'plan_cap_seats' using errcode = 'P0001', detail = format('Your %s plan allows %s manager seats. Upgrade to invite more.', u ->> 'plan_name', u ->> 'seat_cap');
  end if;
end;
$$;

-- Site cap enforced on insert.
create or replace function private.guard_site_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if private.is_admin() or current_setting('role', true) = 'service_role' then return new; end if;
  perform private.require_plan_capacity(new.company_id, 'site');
  return new;
end;
$$;
create trigger sites_guard_insert before insert on public.sites for each row execute function private.guard_site_insert();

-- Seat cap enforced on member insert.
create or replace function private.guard_member_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if private.is_admin() or current_setting('role', true) = 'service_role' then return new; end if;
  if new.role = 'manager' then
    perform private.require_plan_capacity(new.company_id, 'seat');
  end if;
  return new;
end;
$$;
create trigger company_members_guard_insert before insert on public.company_members for each row execute function private.guard_member_insert();

-- ---------- Cost helpers (mirror packages/shared/src/money.ts) ----------
create or replace function private.officer_pay_cents(p_rate_cents integer, p_minutes integer)
returns integer
language sql
immutable
as $$
  select round((p_rate_cents::numeric * p_minutes) / 60)::integer;
$$;

create or replace function private.fee_cents(p_pay_cents integer, p_fee_bps integer)
returns integer
language sql
immutable
as $$
  select round((p_pay_cents::numeric * p_fee_bps) / 10000)::integer;
$$;

create or replace function public.shift_cost(p_shift_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  sh public.shifts%rowtype;
  pl public.plans;
  minutes integer;
  pay integer;
  fee integer;
begin
  select * into sh from public.shifts where id = p_shift_id;
  if not found then raise exception 'shift not found'; end if;
  if sh.company_id <> private.jwt_company_id() and not private.is_admin() and not private.is_officer() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  pl := private.company_plan(sh.company_id);
  minutes := round(extract(epoch from (sh.end_at - sh.start_at)) / 60)::integer;
  pay := private.officer_pay_cents(sh.hourly_rate_cents, minutes);
  fee := private.fee_cents(pay, coalesce(pl.fee_bps, 1000));
  return jsonb_build_object(
    'minutes', minutes, 'officer_pay_cents', pay, 'platform_fee_cents', fee, 'per_officer_total_cents', pay + fee,
    'officers_needed', sh.officers_needed, 'total_cents', (pay + fee) * sh.officers_needed, 'fee_bps', coalesce(pl.fee_bps, 1000));
end;
$$;

-- ---------- Publishing ----------
create or replace function public.publish_shift(p_shift_id uuid)
returns public.shifts
language plpgsql
security definer
set search_path = public
as $$
declare
  sh public.shifts%rowtype;
  pl public.plans;
begin
  perform private.begin_internal();
  select * into sh from public.shifts where id = p_shift_id for update;
  if not found then raise exception 'shift not found'; end if;
  if sh.company_id <> private.jwt_company_id() or not private.is_employer() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if sh.status <> 'draft' then raise exception 'only drafts can be published'; end if;
  if sh.start_at <= now() then raise exception 'shift start must be in the future'; end if;
  pl := private.company_plan(sh.company_id);
  perform private.require_plan_capacity(sh.company_id, 'shift');
  if sh.start_at - now() < make_interval(mins => pl.min_lead_time_minutes) then
    raise exception 'plan_lead_time' using errcode = 'P0001',
      detail = format('Your %s plan needs %s minutes of lead time. Upgrade to Enterprise to post any time.', pl.name, pl.min_lead_time_minutes);
  end if;
  update public.shifts set status = 'open', published_at = now() where id = p_shift_id returning * into sh;
  insert into public.message_threads (shift_id, company_id) values (sh.id, sh.company_id) on conflict (shift_id) do nothing;
  perform private.audit('shift.publish', 'shift', sh.id::text, null, to_jsonb(sh));
  return sh;
end;
$$;

create or replace function public.cancel_shift(p_shift_id uuid, p_reason text default null)
returns public.shifts
language plpgsql
security definer
set search_path = public
as $$
declare
  sh public.shifts%rowtype;
  a record;
begin
  perform private.begin_internal();
  select * into sh from public.shifts where id = p_shift_id for update;
  if not found then raise exception 'shift not found'; end if;
  if not ((sh.company_id = private.jwt_company_id() and private.is_employer()) or private.is_admin()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if sh.status in ('completed', 'cancelled', 'in_progress') then raise exception 'shift cannot be cancelled now'; end if;
  for a in select * from public.assignments where shift_id = p_shift_id and status in ('confirmed') loop
    update public.assignments set status = 'cancelled_by_employer', cancelled_at = now(), cancel_reason = p_reason where id = a.id;
    update public.payments set status = case when status in ('authorized', 'captured') then 'canceled' else status end where assignment_id = a.id and status in ('pending', 'authorized', 'captured');
    perform private.notify(a.officer_id, 'shift.cancelled', 'Shift cancelled', format('%s was cancelled by the employer. Any hold on their card is released.', sh.title), jsonb_build_object('shift_id', sh.id));
  end loop;
  update public.shift_applications set status = 'declined', decided_at = now() where shift_id = p_shift_id and status = 'applied';
  update public.shifts set status = 'cancelled', cancelled_at = now(), cancel_reason = p_reason where id = p_shift_id returning * into sh;
  perform private.audit('shift.cancel', 'shift', sh.id::text, null, to_jsonb(sh));
  return sh;
end;
$$;

-- ---------- Matching ----------
-- Approved, available officers within their own travel radius of the site, license level met,
-- no overlapping booking. Ordered by plan priority (Enterprise > Pro > Essential), then distance, then rating.
create or replace function public.match_candidates(p_shift_id uuid)
returns table (officer_id uuid, distance_mi numeric, rating_avg numeric, license_level integer, priority_rank integer)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  sh public.shifts%rowtype;
  st public.sites%rowtype;
  pl public.plans;
begin
  select * into sh from public.shifts where id = p_shift_id;
  if not found then return; end if;
  if not (private.is_admin() or current_setting('role', true) = 'service_role' or sh.company_id = private.jwt_company_id()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  select * into st from public.sites where id = sh.site_id;
  pl := private.company_plan(sh.company_id);
  return query
    select op.user_id,
           round((private.distance_m(op.home_geo, st.geo) / 1609.344)::numeric, 1),
           op.rating_avg,
           private.officer_license_level(op.user_id),
           coalesce(pl.priority_rank, 0)
    from public.officer_profiles op
    where op.account_status = 'active'
      and op.is_available
      and op.home_geo is not null
      and private.within_m(op.home_geo, st.geo, op.travel_radius_mi * 1609.344)
      and private.officer_license_level(op.user_id) >= sh.required_license_level
      and private.officer_blockers_for(op.user_id) = '{}'
      and not private.officer_has_overlap(op.user_id, sh.start_at, sh.end_at)
      and not exists (select 1 from public.assignments a where a.shift_id = sh.id and a.officer_id = op.user_id and a.status in ('confirmed', 'clocked_in'))
    order by 5 desc, 2 asc, 3 desc;
end;
$$;

-- ---------- Booking (no double booking / overfilling: row lock on the shift) ----------
create or replace function private.create_assignment_locked(p_shift public.shifts, p_officer_id uuid)
returns public.assignments
language plpgsql
security definer
set search_path = public
as $$
declare
  booked integer;
  pl public.plans;
  minutes integer;
  pay integer;
  fee integer;
  a public.assignments%rowtype;
begin
  perform private.begin_internal();
  -- caller must hold FOR UPDATE on the shift row
  select count(*) into booked from public.assignments where shift_id = p_shift.id and status in ('confirmed', 'clocked_in', 'completed');
  if booked >= p_shift.officers_needed then
    raise exception 'shift_full' using errcode = 'P0001', detail = 'All spots on this shift are filled.';
  end if;
  if private.officer_has_overlap(p_officer_id, p_shift.start_at, p_shift.end_at, p_shift.id) then
    raise exception 'officer_overlap' using errcode = 'P0001', detail = 'This officer is already booked at an overlapping time.';
  end if;
  perform private.require_plan_capacity(p_shift.company_id, 'booking');
  pl := private.company_plan(p_shift.company_id);
  minutes := round(extract(epoch from (p_shift.end_at - p_shift.start_at)) / 60)::integer;
  pay := private.officer_pay_cents(p_shift.hourly_rate_cents, minutes);
  fee := private.fee_cents(pay, coalesce(pl.fee_bps, 1000));

  insert into public.assignments (shift_id, officer_id, status) values (p_shift.id, p_officer_id, 'confirmed') returning * into a;
  insert into public.payments (assignment_id, company_id, officer_id, officer_pay_cents, platform_fee_cents, total_cents, fee_bps, status)
    values (a.id, p_shift.company_id, p_officer_id, pay, fee, pay + fee, coalesce(pl.fee_bps, 1000), 'pending');
  update public.shift_applications set status = 'accepted', decided_at = now() where shift_id = p_shift.id and officer_id = p_officer_id and status = 'applied';

  if booked + 1 >= p_shift.officers_needed then
    update public.shifts set status = 'filled' where id = p_shift.id;
    update public.shift_applications set status = 'declined', decided_at = now() where shift_id = p_shift.id and status = 'applied';
  end if;
  perform private.audit('assignment.create', 'assignment', a.id::text, null, to_jsonb(a));
  return a;
end;
$$;

-- Officer taps Accept. Returns {outcome: booked|applied, assignment_id?, application_id?}.
create or replace function public.accept_shift(p_shift_id uuid, p_message text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sh public.shifts%rowtype;
  blockers text[];
  a public.assignments%rowtype;
  app public.shift_applications%rowtype;
begin
  if not private.is_officer() then raise exception 'not authorized' using errcode = '42501'; end if;
  blockers := private.officer_blockers_for(auth.uid());
  if array_length(blockers, 1) > 0 then
    raise exception 'officer_not_eligible' using errcode = 'P0001', detail = array_to_string(blockers, ',');
  end if;
  select * into sh from public.shifts where id = p_shift_id for update;
  if not found or sh.status <> 'open' then
    raise exception 'shift_unavailable' using errcode = 'P0001', detail = 'This shift is no longer open.';
  end if;
  if sh.start_at <= now() then
    raise exception 'shift_started' using errcode = 'P0001', detail = 'This shift has already started.';
  end if;
  if private.officer_license_level(auth.uid()) < sh.required_license_level then
    raise exception 'license_level' using errcode = 'P0001', detail = format('This shift requires a Level %s license.', sh.required_license_level);
  end if;
  if exists (select 1 from public.assignments where shift_id = sh.id and officer_id = auth.uid() and status in ('confirmed', 'clocked_in')) then
    raise exception 'already_booked' using errcode = 'P0001', detail = 'You are already booked on this shift.';
  end if;

  if sh.fill_mode = 'auto' then
    a := private.create_assignment_locked(sh, auth.uid());
    perform private.notify_company(sh.company_id, 'shift.booked', 'Officer booked',
      format('%s accepted %s.', (select full_name from public.profiles where id = auth.uid()), sh.title),
      jsonb_build_object('shift_id', sh.id, 'assignment_id', a.id));
    return jsonb_build_object('outcome', 'booked', 'assignment_id', a.id);
  end if;

  insert into public.shift_applications (shift_id, officer_id, message)
    values (sh.id, auth.uid(), p_message)
    on conflict (shift_id, officer_id) do update set status = 'applied', message = excluded.message, decided_at = null, decided_by = null
    returning * into app;
  perform private.notify_company(sh.company_id, 'shift.applied', 'New applicant',
    format('%s applied to %s.', (select full_name from public.profiles where id = auth.uid()), sh.title),
    jsonb_build_object('shift_id', sh.id, 'application_id', app.id));
  return jsonb_build_object('outcome', 'applied', 'application_id', app.id);
end;
$$;

create or replace function public.withdraw_application(p_shift_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.shift_applications set status = 'withdrawn', decided_at = now()
  where shift_id = p_shift_id and officer_id = auth.uid() and status = 'applied';
end;
$$;

-- Employer confirms an applicant (review mode).
create or replace function public.confirm_applicant(p_application_id uuid)
returns public.assignments
language plpgsql
security definer
set search_path = public
as $$
declare
  app public.shift_applications%rowtype;
  sh public.shifts%rowtype;
  a public.assignments%rowtype;
begin
  select * into app from public.shift_applications where id = p_application_id for update;
  if not found then raise exception 'application not found'; end if;
  select * into sh from public.shifts where id = app.shift_id for update;
  if not ((sh.company_id = private.jwt_company_id() and private.is_employer()) or private.is_admin()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if app.status <> 'applied' then raise exception 'application already decided'; end if;
  if sh.status <> 'open' then raise exception 'shift_unavailable' using errcode = 'P0001', detail = 'This shift is no longer open.'; end if;
  if array_length(private.officer_blockers_for(app.officer_id), 1) > 0 then
    raise exception 'officer_not_eligible' using errcode = 'P0001', detail = 'This officer is no longer eligible.';
  end if;
  a := private.create_assignment_locked(sh, app.officer_id);
  update public.shift_applications set decided_by = auth.uid() where id = p_application_id;
  perform private.notify(app.officer_id, 'shift.confirmed', 'You are booked',
    format('%s confirmed you for %s.', (select name from public.companies where id = sh.company_id), sh.title),
    jsonb_build_object('shift_id', sh.id, 'assignment_id', a.id));
  return a;
end;
$$;

create or replace function public.decline_applicant(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  app public.shift_applications%rowtype;
  sh public.shifts%rowtype;
begin
  select * into app from public.shift_applications where id = p_application_id for update;
  if not found then raise exception 'application not found'; end if;
  select * into sh from public.shifts where id = app.shift_id;
  if not ((sh.company_id = private.jwt_company_id() and private.is_employer()) or private.is_admin()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  update public.shift_applications set status = 'declined', decided_at = now(), decided_by = auth.uid() where id = p_application_id and status = 'applied';
  perform private.notify(app.officer_id, 'shift.declined', 'Application update', format('The employer chose another officer for %s.', sh.title), jsonb_build_object('shift_id', sh.id));
end;
$$;

-- Officer cancels a booking. Under late_cancel_hours before start = strike.
create or replace function public.cancel_assignment_by_officer(p_assignment_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.assignments%rowtype;
  sh public.shifts%rowtype;
  late boolean;
  hours integer := private.setting_int('late_cancel_hours', 12);
begin
  perform private.begin_internal();
  select * into a from public.assignments where id = p_assignment_id for update;
  if not found or a.officer_id <> auth.uid() then raise exception 'not authorized' using errcode = '42501'; end if;
  if a.status <> 'confirmed' then raise exception 'booking cannot be cancelled now'; end if;
  select * into sh from public.shifts where id = a.shift_id for update;
  late := sh.start_at - now() < make_interval(hours => hours);
  update public.assignments set status = 'cancelled_by_officer', cancelled_at = now(), cancel_reason = p_reason where id = a.id;
  update public.payments set status = 'canceled' where assignment_id = a.id and status in ('pending', 'authorized', 'captured');
  if late then
    insert into public.strikes (officer_id, assignment_id, type, notes) values (a.officer_id, a.id, 'late_cancel', p_reason);
    update public.officer_profiles set late_cancel_count = late_cancel_count + 1 where user_id = a.officer_id;
    perform private.run_deactivation_check(a.officer_id);
  end if;
  -- Reopen the spot as urgent.
  if sh.status in ('filled', 'open') then
    update public.shifts set status = 'open', is_urgent = true where id = sh.id;
  end if;
  perform private.notify_company(sh.company_id, 'shift.officer_cancelled', 'Officer cancelled',
    format('An officer cancelled %s. The spot is reopened as urgent.', sh.title), jsonb_build_object('shift_id', sh.id));
  perform private.audit('assignment.cancel_by_officer', 'assignment', a.id::text, to_jsonb(a), jsonb_build_object('late', late));
  return jsonb_build_object('late_cancellation', late);
end;
$$;

-- ---------- Clock in / out ----------
create or replace function public.clock_in(p_assignment_id uuid, p_lat double precision, p_lng double precision, p_accuracy_m numeric default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.assignments%rowtype;
  sh public.shifts%rowtype;
  st public.sites%rowtype;
  pt public.geo_point;
  dist double precision;
  early_min integer := private.setting_int('clock_in_early_minutes', 15);
begin
  perform private.begin_internal();
  select * into a from public.assignments where id = p_assignment_id for update;
  if not found or a.officer_id <> auth.uid() then raise exception 'not authorized' using errcode = '42501'; end if;
  if a.status <> 'confirmed' then raise exception 'not_clockable' using errcode = 'P0001', detail = 'This booking is not awaiting clock-in.'; end if;
  select * into sh from public.shifts where id = a.shift_id;
  select * into st from public.sites where id = sh.site_id;
  if now() < sh.start_at - make_interval(mins => early_min) then
    return jsonb_build_object('ok', false, 'reason', 'too_early', 'opens_at', sh.start_at - make_interval(mins => early_min));
  end if;
  pt := private.make_point(p_lat, p_lng);
  dist := private.distance_m(pt, st.geo);
  if dist > st.geofence_radius_m and not a.clock_in_override then
    return jsonb_build_object('ok', false, 'reason', 'outside_geofence', 'distance_m', round(dist::numeric), 'radius_m', st.geofence_radius_m);
  end if;
  update public.assignments set status = 'clocked_in', clock_in_at = now(), clock_in_geo = pt, clock_in_accuracy_m = p_accuracy_m where id = a.id;
  insert into public.location_pings (assignment_id, geo, accuracy_m) values (a.id, pt, p_accuracy_m);
  update public.shifts set status = 'in_progress' where id = sh.id and status in ('open', 'filled');
  perform private.notify_company(sh.company_id, 'shift.clock_in', 'Officer on site',
    format('%s clocked in at %s.', (select full_name from public.profiles where id = auth.uid()), st.name),
    jsonb_build_object('shift_id', sh.id, 'assignment_id', a.id));
  return jsonb_build_object('ok', true, 'clock_in_at', now(), 'distance_m', round(dist::numeric));
end;
$$;

create or replace function public.request_clock_in_override(p_assignment_id uuid, p_lat double precision, p_lng double precision)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.assignments%rowtype;
  sh public.shifts%rowtype;
begin
  select * into a from public.assignments where id = p_assignment_id for update;
  if not found or a.officer_id <> auth.uid() then raise exception 'not authorized' using errcode = '42501'; end if;
  select * into sh from public.shifts where id = a.shift_id;
  update public.assignments set override_requested_at = now() where id = a.id;
  perform private.notify_company(sh.company_id, 'shift.override_requested', 'Clock-in override requested',
    format('%s says they are on site but outside the geofence for %s. Approve in the app.', (select full_name from public.profiles where id = auth.uid()), sh.title),
    jsonb_build_object('shift_id', sh.id, 'assignment_id', a.id, 'lat', p_lat, 'lng', p_lng));
end;
$$;

create or replace function public.approve_clock_in_override(p_assignment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.assignments%rowtype;
  sh public.shifts%rowtype;
begin
  select * into a from public.assignments where id = p_assignment_id for update;
  if not found then raise exception 'assignment not found'; end if;
  select * into sh from public.shifts where id = a.shift_id;
  if not ((sh.company_id = private.jwt_company_id() and private.is_employer()) or private.is_admin()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  update public.assignments set clock_in_override = true where id = a.id;
  perform private.notify(a.officer_id, 'shift.override_approved', 'Override approved', 'The employer approved your clock-in. Tap Clock in again.', jsonb_build_object('assignment_id', a.id));
end;
$$;

create or replace function public.record_location_ping(p_assignment_id uuid, p_lat double precision, p_lng double precision, p_accuracy_m numeric default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.assignments%rowtype;
begin
  select * into a from public.assignments where id = p_assignment_id;
  if not found or a.officer_id <> auth.uid() then raise exception 'not authorized' using errcode = '42501'; end if;
  -- Only while clocked in: location is never recorded outside an active shift.
  if a.status <> 'clocked_in' then return; end if;
  insert into public.location_pings (assignment_id, geo, accuracy_m) values (a.id, private.make_point(p_lat, p_lng), p_accuracy_m);
end;
$$;

create or replace function public.clock_out(p_assignment_id uuid, p_lat double precision, p_lng double precision, p_accuracy_m numeric default null, p_notes text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.assignments%rowtype;
  sh public.shifts%rowtype;
  pt public.geo_point;
  worked integer;
  remaining integer;
begin
  perform private.begin_internal();
  select * into a from public.assignments where id = p_assignment_id for update;
  if not found or a.officer_id <> auth.uid() then raise exception 'not authorized' using errcode = '42501'; end if;
  if a.status <> 'clocked_in' then raise exception 'not_clocked_in' using errcode = 'P0001', detail = 'You are not clocked in.'; end if;
  select * into sh from public.shifts where id = a.shift_id;
  pt := private.make_point(p_lat, p_lng);
  worked := greatest(0, round(extract(epoch from (now() - a.clock_in_at)) / 60)::integer);
  update public.assignments
    set status = 'completed', clock_out_at = now(), clock_out_geo = pt, clock_out_accuracy_m = p_accuracy_m, clock_out_notes = p_notes, approval_status = 'pending'
    where id = a.id;
  insert into public.location_pings (assignment_id, geo, accuracy_m) values (a.id, pt, p_accuracy_m);
  select count(*) into remaining from public.assignments where shift_id = sh.id and status = 'clocked_in';
  if remaining = 0 and now() >= sh.end_at - interval '30 minutes' then
    update public.shifts set status = 'completed' where id = sh.id and status = 'in_progress';
  end if;
  perform private.notify_company(sh.company_id, 'shift.clock_out', 'Timesheet ready',
    format('%s clocked out of %s. Approve or dispute the timesheet within %s hours.', (select full_name from public.profiles where id = auth.uid()), sh.title, private.setting_int('auto_approve_hours', 24)),
    jsonb_build_object('shift_id', sh.id, 'assignment_id', a.id));
  return jsonb_build_object('ok', true, 'worked_minutes', worked);
end;
$$;

-- ---------- Timesheet approval / dispute ----------
create or replace function public.approve_timesheet(p_assignment_id uuid, p_approved_minutes integer default null)
returns public.assignments
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.assignments%rowtype;
  sh public.shifts%rowtype;
  worked integer;
  scheduled integer;
begin
  perform private.begin_internal();
  select * into a from public.assignments where id = p_assignment_id for update;
  if not found then raise exception 'assignment not found'; end if;
  select * into sh from public.shifts where id = a.shift_id;
  if not ((sh.company_id = private.jwt_company_id() and private.is_employer()) or private.is_admin()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if a.status <> 'completed' or a.approval_status not in ('pending', 'disputed') then
    raise exception 'timesheet is not awaiting approval';
  end if;
  worked := greatest(0, round(extract(epoch from (coalesce(a.clock_out_at, now()) - a.clock_in_at)) / 60)::integer);
  scheduled := round(extract(epoch from (sh.end_at - sh.start_at)) / 60)::integer;
  update public.assignments
    set approved_minutes = least(coalesce(p_approved_minutes, worked), scheduled), approval_status = 'approved', approved_at = now(), approved_by = auth.uid()
    where id = a.id returning * into a;
  update public.officer_profiles set completed_shifts = completed_shifts + 1 where user_id = a.officer_id;
  update public.disputes set status = 'resolved_adjusted', resolved_by = auth.uid(), resolved_at = now(), resolved_minutes = a.approved_minutes where assignment_id = a.id and status = 'open';
  perform private.notify(a.officer_id, 'timesheet.approved', 'Timesheet approved',
    format('%s approved %s minutes for %s. Your payout is on its way.', (select name from public.companies where id = sh.company_id), a.approved_minutes, sh.title),
    jsonb_build_object('assignment_id', a.id));
  perform private.audit('timesheet.approve', 'assignment', a.id::text, null, to_jsonb(a));
  return a;
end;
$$;

create or replace function public.dispute_timesheet(p_assignment_id uuid, p_reason text, p_notes text default null)
returns public.disputes
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.assignments%rowtype;
  sh public.shifts%rowtype;
  d public.disputes%rowtype;
  is_officer boolean;
begin
  select * into a from public.assignments where id = p_assignment_id for update;
  if not found then raise exception 'assignment not found'; end if;
  select * into sh from public.shifts where id = a.shift_id;
  is_officer := a.officer_id = auth.uid();
  if not (is_officer or (sh.company_id = private.jwt_company_id() and private.is_employer()) or private.is_admin()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if a.status <> 'completed' then raise exception 'only completed shifts can be disputed'; end if;
  update public.assignments set approval_status = 'disputed' where id = a.id;
  insert into public.disputes (assignment_id, opened_by, reason, employer_notes, officer_notes)
    values (a.id, auth.uid(), p_reason, case when is_officer then null else p_notes end, case when is_officer then p_notes else null end)
    on conflict (assignment_id) do update set
      employer_notes = coalesce(excluded.employer_notes, public.disputes.employer_notes),
      officer_notes = coalesce(excluded.officer_notes, public.disputes.officer_notes),
      status = 'open'
    returning * into d;
  if is_officer then
    perform private.notify_company(sh.company_id, 'timesheet.disputed', 'Timesheet disputed', format('The officer disputed the timesheet for %s.', sh.title), jsonb_build_object('assignment_id', a.id));
  else
    perform private.notify(a.officer_id, 'timesheet.disputed', 'Timesheet disputed', format('The employer disputed your timesheet for %s. An admin will review the GPS record.', sh.title), jsonb_build_object('assignment_id', a.id));
  end if;
  perform private.audit('timesheet.dispute', 'assignment', a.id::text, null, to_jsonb(d));
  return d;
end;
$$;

-- Admin resolves a dispute with a final minute count (then approve_timesheet runs the payout path).
create or replace function public.admin_resolve_dispute(p_assignment_id uuid, p_resolved_minutes integer, p_notes text default null)
returns public.assignments
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.assignments%rowtype;
  sh public.shifts%rowtype;
  scheduled integer;
begin
  perform private.begin_internal();
  if not private.is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  select * into a from public.assignments where id = p_assignment_id for update;
  if not found then raise exception 'assignment not found'; end if;
  select * into sh from public.shifts where id = a.shift_id;
  scheduled := round(extract(epoch from (sh.end_at - sh.start_at)) / 60)::integer;
  update public.assignments
    set approved_minutes = least(greatest(p_resolved_minutes, 0), scheduled), approval_status = 'approved', approved_at = now(), approved_by = auth.uid()
    where id = a.id returning * into a;
  update public.disputes set status = (case when p_resolved_minutes = 0 then 'resolved_refund' when a.approved_minutes = scheduled then 'resolved_full' else 'resolved_adjusted' end)::public.dispute_status,
    resolved_by = auth.uid(), resolved_at = now(), resolution_notes = p_notes, resolved_minutes = a.approved_minutes
    where assignment_id = a.id;
  if a.approved_minutes > 0 then
    update public.officer_profiles set completed_shifts = completed_shifts + 1 where user_id = a.officer_id;
  end if;
  perform private.notify(a.officer_id, 'dispute.resolved', 'Dispute resolved', format('An admin approved %s minutes for %s.', a.approved_minutes, sh.title), jsonb_build_object('assignment_id', a.id));
  perform private.notify_company(sh.company_id, 'dispute.resolved', 'Dispute resolved', format('An admin approved %s minutes for %s.', a.approved_minutes, sh.title), jsonb_build_object('assignment_id', a.id));
  perform private.audit('dispute.resolve', 'assignment', a.id::text, null, to_jsonb(a));
  return a;
end;
$$;

-- ---------- Ratings ----------
create or replace function public.rate_assignment(p_assignment_id uuid, p_stars integer, p_tags text[] default '{}', p_comment text default null)
returns public.ratings
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.assignments%rowtype;
  sh public.shifts%rowtype;
  r public.ratings%rowtype;
  dir public.rating_direction;
  ratee uuid;
begin
  perform private.begin_internal();
  select * into a from public.assignments where id = p_assignment_id;
  if not found then raise exception 'assignment not found'; end if;
  select * into sh from public.shifts where id = a.shift_id;
  if a.status <> 'completed' or a.approval_status not in ('approved', 'auto_approved') then
    raise exception 'ratings open after the timesheet is approved';
  end if;
  if a.officer_id = auth.uid() then
    dir := 'officer_to_employer';
    ratee := coalesce(sh.created_by, (select user_id from public.company_members where company_id = sh.company_id and role = 'owner' limit 1));
  elsif sh.company_id = private.jwt_company_id() and private.is_employer() then
    dir := 'employer_to_officer';
    ratee := a.officer_id;
  else
    raise exception 'not authorized' using errcode = '42501';
  end if;
  insert into public.ratings (assignment_id, rater_id, ratee_id, direction, stars, tags, comment)
    values (a.id, auth.uid(), ratee, dir, p_stars, coalesce(p_tags, '{}'), p_comment)
    on conflict (assignment_id, direction) do update set stars = excluded.stars, tags = excluded.tags, comment = excluded.comment
    returning * into r;
  if dir = 'employer_to_officer' then
    update public.officer_profiles op set
      rating_avg = sub.avg, rating_count = sub.cnt
    from (select round(avg(stars)::numeric, 2) as avg, count(*) as cnt from public.ratings where ratee_id = a.officer_id and direction = 'employer_to_officer') sub
    where op.user_id = a.officer_id;
    perform private.run_deactivation_check(a.officer_id);
  end if;
  return r;
end;
$$;

-- ---------- Incident reports ----------
create or replace function public.file_incident_report(p_assignment_id uuid, p_type public.incident_type, p_description text, p_occurred_at timestamptz default now(), p_lat double precision default null, p_lng double precision default null, p_photo_paths text[] default '{}')
returns public.incident_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.assignments%rowtype;
  sh public.shifts%rowtype;
  r public.incident_reports%rowtype;
begin
  select * into a from public.assignments where id = p_assignment_id;
  if not found or a.officer_id <> auth.uid() then raise exception 'not authorized' using errcode = '42501'; end if;
  if a.status not in ('clocked_in', 'completed') then raise exception 'incident reports can be filed during or right after a shift'; end if;
  select * into sh from public.shifts where id = a.shift_id;
  insert into public.incident_reports (assignment_id, shift_id, company_id, officer_id, type, description, occurred_at, geo, photo_paths)
    values (a.id, sh.id, sh.company_id, auth.uid(), p_type, p_description, p_occurred_at,
      case when p_lat is null or p_lng is null then null else private.make_point(p_lat, p_lng) end, coalesce(p_photo_paths, '{}'))
    returning * into r;
  perform private.notify_company(sh.company_id, 'incident.filed', 'Incident report',
    format('%s filed a %s report at %s.', (select full_name from public.profiles where id = auth.uid()), replace(p_type::text, '_', ' '), (select name from public.sites where id = sh.site_id)),
    jsonb_build_object('incident_id', r.id, 'shift_id', sh.id));
  return r;
end;
$$;

-- ---------- Deactivation check (called after ratings and strikes, and nightly) ----------
create or replace function private.run_deactivation_check(p_officer_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  op public.officer_profiles%rowtype;
  min_rating numeric := private.setting_numeric('deactivate_min_rating', 4.0);
  min_rated integer := private.setting_int('deactivate_min_rated_shifts', 10);
  max_no_shows integer := private.setting_int('deactivate_no_shows_90d', 2);
  max_late integer := private.setting_int('deactivate_late_cancels_90d', 3);
  no_shows integer;
  lates integer;
  reason text := null;
  warn text := null;
begin
  perform private.begin_internal();
  select * into op from public.officer_profiles where user_id = p_officer_id;
  if not found or op.account_status <> 'active' then return false; end if;
  select count(*) into no_shows from public.strikes where officer_id = p_officer_id and type = 'no_show' and created_at >= now() - interval '90 days';
  select count(*) into lates from public.strikes where officer_id = p_officer_id and type = 'late_cancel' and created_at >= now() - interval '90 days';

  if op.rating_count >= min_rated and op.rating_avg < min_rating then
    reason := format('Rating %s below %s after %s rated shifts', op.rating_avg, min_rating, op.rating_count);
  elsif no_shows >= max_no_shows then
    reason := format('%s no-shows in 90 days', no_shows);
  elsif lates >= max_late then
    reason := format('%s late cancellations in 90 days', lates);
  elsif no_shows = max_no_shows - 1 then
    warn := format('One more no-show in the next 90 days will deactivate your account (%s of %s).', no_shows, max_no_shows);
  elsif lates = max_late - 1 then
    warn := format('One more late cancellation in the next 90 days will deactivate your account (%s of %s).', lates, max_late);
  end if;

  if reason is not null then
    update public.officer_profiles set account_status = 'deactivated', status_reason = reason, deactivated_at = now(), is_available = false where user_id = p_officer_id;
    perform private.notify(p_officer_id, 'account.deactivated', 'Account deactivated', reason || '. Contact ShiftShield to appeal.', '{}'::jsonb);
    perform private.audit('officer.deactivate', 'officer', p_officer_id::text, to_jsonb(op), jsonb_build_object('reason', reason));
    return true;
  elsif warn is not null then
    perform private.notify(p_officer_id, 'account.warning', 'Account warning', warn, '{}'::jsonb);
  end if;
  return false;
end;
$$;

-- ---------- Admin actions ----------
create or replace function public.admin_review_license(p_license_id uuid, p_approve boolean, p_reason text default null)
returns public.officer_licenses
language plpgsql
security definer
set search_path = public
as $$
declare
  l public.officer_licenses%rowtype;
  op public.officer_profiles%rowtype;
begin
  perform private.begin_internal();
  if not private.is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  select * into l from public.officer_licenses where id = p_license_id for update;
  if not found then raise exception 'license not found'; end if;
  update public.officer_licenses
    set status = (case when p_approve then 'approved' else 'rejected' end)::public.license_status, reviewed_by = auth.uid(), reviewed_at = now(), rejection_reason = case when p_approve then null else p_reason end
    where id = p_license_id returning * into l;
  select * into op from public.officer_profiles where user_id = l.officer_id;
  if p_approve then
    if op.account_status = 'onboarding' and op.signup_fee_paid_at is not null and op.background_status = 'clear' then
      update public.officer_profiles set account_status = 'active' where user_id = l.officer_id;
    end if;
    perform private.notify(l.officer_id, 'license.approved', 'License approved', 'Your Texas DPS license was approved. Connect your payout account and start accepting shifts.', '{}'::jsonb, 'push');
    perform private.notify(l.officer_id, 'license.approved', 'License approved', 'Your Texas DPS license was approved. Connect your payout account and start accepting shifts.', '{}'::jsonb, 'email');
  else
    perform private.notify(l.officer_id, 'license.rejected', 'License needs attention', coalesce(p_reason, 'Please re-upload a clear photo of your license.'), '{}'::jsonb, 'push');
    perform private.notify(l.officer_id, 'license.rejected', 'License needs attention', coalesce(p_reason, 'Please re-upload a clear photo of your license.'), '{}'::jsonb, 'email');
  end if;
  perform private.audit('license.review', 'officer_license', l.id::text, null, to_jsonb(l));
  return l;
end;
$$;

create or replace function public.admin_set_officer_status(p_officer_id uuid, p_status public.officer_account_status, p_reason text default null)
returns public.officer_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  op public.officer_profiles%rowtype;
  before_row public.officer_profiles%rowtype;
begin
  perform private.begin_internal();
  if not private.is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  select * into before_row from public.officer_profiles where user_id = p_officer_id for update;
  if not found then raise exception 'officer not found'; end if;
  update public.officer_profiles set account_status = p_status, status_reason = p_reason,
    deactivated_at = case when p_status = 'deactivated' then now() else null end,
    is_available = case when p_status = 'active' then is_available else false end
    where user_id = p_officer_id returning * into op;
  perform private.notify(p_officer_id, 'account.status', 'Account update', format('Your account is now %s. %s', replace(p_status::text, '_', ' '), coalesce(p_reason, '')), '{}'::jsonb);
  perform private.audit('officer.status', 'officer', p_officer_id::text, to_jsonb(before_row), to_jsonb(op));
  return op;
end;
$$;

create or replace function public.admin_set_background_status(p_officer_id uuid, p_status public.background_status, p_provider text default 'manual', p_reference text default null)
returns public.officer_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  op public.officer_profiles%rowtype;
begin
  perform private.begin_internal();
  if not (private.is_admin() or current_setting('role', true) = 'service_role') then raise exception 'not authorized' using errcode = '42501'; end if;
  update public.officer_profiles set background_status = p_status, background_provider = p_provider, background_reference = p_reference, background_updated_at = now()
    where user_id = p_officer_id returning * into op;
  if p_status = 'clear' and op.account_status = 'onboarding' and op.signup_fee_paid_at is not null
     and exists (select 1 from public.officer_licenses where officer_id = p_officer_id and status = 'approved' and expires_on >= current_date) then
    update public.officer_profiles set account_status = 'active' where user_id = p_officer_id returning * into op;
  end if;
  perform private.audit('officer.background', 'officer', p_officer_id::text, null, jsonb_build_object('status', p_status, 'provider', p_provider));
  return op;
end;
$$;

create or replace function public.admin_set_company_pilot(p_company_id uuid, p_is_pilot boolean, p_pilot_ends_at timestamptz default null)
returns public.companies
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.companies%rowtype;
begin
  if not private.is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  update public.companies set is_pilot = p_is_pilot, pilot_ends_at = case when p_is_pilot then coalesce(p_pilot_ends_at, now() + interval '30 days') else null end
    where id = p_company_id returning * into c;
  perform private.audit('company.pilot', 'company', c.id::text, null, to_jsonb(c));
  return c;
end;
$$;

create or replace function public.admin_set_company_plan(p_company_id uuid, p_plan_code public.plan_code)
returns public.companies
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.companies%rowtype;
begin
  if not private.is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  update public.companies set plan_id = (select id from public.plans where code = p_plan_code),
    subscription_status = case when subscription_status = 'none' then 'active' else subscription_status end
    where id = p_company_id returning * into c;
  perform private.audit('company.plan', 'company', c.id::text, null, to_jsonb(c));
  return c;
end;
$$;

-- ---------- Onboarding helpers ----------

-- Owner creates the company and becomes its owner member in one call (RLS-safe because the JWT has no company yet).
create or replace function public.create_company(p_name text, p_type public.company_type, p_phone text default null, p_billing_email text default null, p_dba text default null, p_dps_license_no text default null)
returns public.companies
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.companies%rowtype;
begin
  perform private.begin_internal();
  if auth.uid() is null then raise exception 'not authorized' using errcode = '42501'; end if;
  if exists (select 1 from public.company_members where user_id = auth.uid()) then
    raise exception 'already_member' using errcode = 'P0001', detail = 'You already belong to a company.';
  end if;
  update public.profiles set role = 'employer_owner' where id = auth.uid() and role in ('employer_owner', 'employer_manager', 'officer');
  insert into public.companies (name, type, phone, billing_email, dba, dps_license_no, created_by)
    values (p_name, p_type, p_phone, p_billing_email, p_dba, p_dps_license_no, auth.uid()) returning * into c;
  insert into public.company_members (company_id, user_id, role) values (c.id, auth.uid(), 'owner');
  perform private.audit('company.create', 'company', c.id::text, null, to_jsonb(c));
  return c;
end;
$$;

create or replace function public.accept_company_invite(p_token text)
returns public.companies
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.company_invites%rowtype;
  c public.companies%rowtype;
begin
  perform private.begin_internal();
  if auth.uid() is null then raise exception 'not authorized' using errcode = '42501'; end if;
  select * into inv from public.company_invites where token = p_token and accepted_at is null and expires_at > now() for update;
  if not found then raise exception 'invite_invalid' using errcode = 'P0001', detail = 'This invite is invalid or expired.'; end if;
  if lower(inv.email) <> lower((select email from public.profiles where id = auth.uid())) then
    raise exception 'invite_email_mismatch' using errcode = 'P0001', detail = 'Sign in with the invited email address.';
  end if;
  perform private.require_plan_capacity(inv.company_id, 'seat');
  update public.profiles set role = 'employer_manager' where id = auth.uid();
  insert into public.company_members (company_id, user_id, role) values (inv.company_id, auth.uid(), inv.role);
  update public.company_invites set accepted_at = now(), accepted_by = auth.uid() where id = inv.id;
  select * into c from public.companies where id = inv.company_id;
  return c;
end;
$$;

create or replace function public.upsert_officer_profile(p_home_lat double precision, p_home_lng double precision, p_home_city text, p_home_zip text, p_travel_radius_mi integer, p_is_18_plus boolean, p_is_21_plus boolean)
returns public.officer_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  op public.officer_profiles%rowtype;
begin
  if auth.uid() is null then raise exception 'not authorized' using errcode = '42501'; end if;
  if not p_is_18_plus then raise exception 'must_be_18' using errcode = 'P0001', detail = 'Officers must be 18 or older.'; end if;
  insert into public.officer_profiles (user_id, home_geo, home_city, home_zip, travel_radius_mi, is_18_plus, is_21_plus)
    values (auth.uid(), private.make_point(p_home_lat, p_home_lng), p_home_city, p_home_zip, coalesce(p_travel_radius_mi, 25), p_is_18_plus, p_is_21_plus)
    on conflict (user_id) do update set home_geo = excluded.home_geo, home_city = excluded.home_city, home_zip = excluded.home_zip,
      travel_radius_mi = excluded.travel_radius_mi, is_18_plus = excluded.is_18_plus, is_21_plus = excluded.is_21_plus
    returning * into op;
  return op;
end;
$$;

create or replace function public.record_agreement(p_doc_slug text, p_version text, p_ip_hash text default null)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.user_agreements (user_id, doc_slug, version, ip_hash) values (auth.uid(), p_doc_slug, p_version, p_ip_hash);
$$;

-- Shift read model for the apps: a shift with its site, cost, booked count and the caller's relationship.
create or replace function public.shift_feed(p_only_open boolean default true, p_limit integer default 50)
returns table (
  shift jsonb, site jsonb, company jsonb, distance_mi numeric, booked integer, my_assignment_id uuid, my_application_status public.application_status, saved boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  home public.geo_point;
  radius_mi integer;
begin
  select op.home_geo, op.travel_radius_mi into home, radius_mi from public.officer_profiles op where op.user_id = auth.uid();
  return query
    select to_jsonb(sh) - 'requirements' || jsonb_build_object('requirements', sh.requirements, 'cost', public.shift_cost(sh.id)),
           to_jsonb(st) - 'geo' || jsonb_build_object('geo', public.geo_to_json(st.geo)),
           (select to_jsonb(cc) from public.company_card(sh.company_id) cc),
           case when home is null then null else round((private.distance_m(home, st.geo) / 1609.344)::numeric, 1) end,
           (select count(*)::integer from public.assignments a where a.shift_id = sh.id and a.status in ('confirmed', 'clocked_in', 'completed')),
           (select a.id from public.assignments a where a.shift_id = sh.id and a.officer_id = auth.uid() and a.status in ('confirmed', 'clocked_in', 'completed') limit 1),
           (select s.status from public.shift_applications s where s.shift_id = sh.id and s.officer_id = auth.uid() limit 1),
           exists (select 1 from public.saved_shifts ss where ss.shift_id = sh.id and ss.officer_id = auth.uid())
    from public.shifts sh
    join public.sites st on st.id = sh.site_id
    where (not p_only_open or sh.status = 'open')
      and (not p_only_open or sh.start_at > now())
      and (sh.status = 'open' or private.officer_involved_in_shift(sh.id) or sh.company_id = private.jwt_company_id() or private.is_admin())
      and (home is null or not p_only_open or private.within_m(home, st.geo, coalesce(radius_mi, 25) * 1609.344))
    order by sh.start_at asc
    limit p_limit;
end;
$$;
