-- Scheduled jobs (invoked by pg_cron, see 20261021000800_cron.sql). All run as the owner (service role).

-- No-show: not clocked in `no_show_after_minutes` after start. Refund employer (payment status), strike, reopen as urgent.
create or replace function private.mark_no_shows()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  grace integer := private.setting_int('no_show_after_minutes', 30);
  r record;
  n integer := 0;
begin
  perform private.begin_internal();
  for r in
    select a.id as assignment_id, a.officer_id, sh.id as shift_id, sh.company_id, sh.title, sh.officers_needed
    from public.assignments a
    join public.shifts sh on sh.id = a.shift_id
    where a.status = 'confirmed' and sh.status in ('open', 'filled', 'in_progress')
      and now() >= sh.start_at + make_interval(mins => grace)
    for update of a skip locked
  loop
    update public.assignments set status = 'no_show', no_show_at = now() where id = r.assignment_id;
    -- Refund is executed by the stripe side (Edge Function) when it sees status = 'canceled' on a captured payment;
    -- we flag intent here and the payments reconciler picks it up.
    update public.payments set status = 'canceled' where assignment_id = r.assignment_id and status in ('pending', 'authorized', 'captured');
    insert into public.strikes (officer_id, assignment_id, type) values (r.officer_id, r.assignment_id, 'no_show');
    update public.officer_profiles set no_show_count = no_show_count + 1 where user_id = r.officer_id;
    perform private.run_deactivation_check(r.officer_id);
    update public.shifts set status = 'open', is_urgent = true where id = r.shift_id and status in ('filled', 'open');
    perform private.notify(r.officer_id, 'assignment.no_show', 'Marked as no-show', format('You did not clock in to %s. This counts as a strike.', r.title), jsonb_build_object('assignment_id', r.assignment_id));
    perform private.notify_company(r.company_id, 'assignment.no_show', 'Officer no-show', format('An officer did not clock in to %s. You have been refunded and the spot is reopened as urgent.', r.title), jsonb_build_object('shift_id', r.shift_id));
    perform private.audit('assignment.no_show', 'assignment', r.assignment_id::text, null, jsonb_build_object('officer_id', r.officer_id));
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Auto-approve timesheets the employer ignored for `auto_approve_hours`.
create or replace function private.auto_approve_timesheets()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  hours integer := private.setting_int('auto_approve_hours', 24);
  r record;
  n integer := 0;
  worked integer;
  scheduled integer;
begin
  perform private.begin_internal();
  for r in
    select a.*, sh.start_at, sh.end_at, sh.company_id, sh.title
    from public.assignments a
    join public.shifts sh on sh.id = a.shift_id
    where a.status = 'completed' and a.approval_status = 'pending'
      and a.clock_out_at <= now() - make_interval(hours => hours)
    for update of a skip locked
  loop
    worked := greatest(0, round(extract(epoch from (r.clock_out_at - r.clock_in_at)) / 60)::integer);
    scheduled := round(extract(epoch from (r.end_at - r.start_at)) / 60)::integer;
    update public.assignments set approved_minutes = least(worked, scheduled), approval_status = 'auto_approved', approved_at = now() where id = r.id;
    update public.officer_profiles set completed_shifts = completed_shifts + 1 where user_id = r.officer_id;
    perform private.notify(r.officer_id, 'timesheet.auto_approved', 'Timesheet auto-approved', format('%s was approved automatically. Your payout is on its way.', r.title), jsonb_build_object('assignment_id', r.id));
    perform private.notify_company(r.company_id, 'timesheet.auto_approved', 'Timesheet auto-approved', format('The timesheet for %s was approved automatically after %s hours.', r.title, hours), jsonb_build_object('assignment_id', r.id));
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- License expiry: warn at 30/14/3 days, expire + block when past.
create or replace function private.process_license_expiry()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  warned integer := 0;
  expired integer := 0;
  days integer;
begin
  perform private.begin_internal();
  for r in select * from public.officer_licenses where status = 'approved' loop
    days := r.expires_on - current_date;
    if days < 0 then
      update public.officer_licenses set status = 'expired' where id = r.id;
      perform private.notify(r.officer_id, 'license.expired', 'License expired', 'Your Texas DPS license has expired. Upload the renewed license to accept shifts again.', '{}'::jsonb, 'push');
      perform private.notify(r.officer_id, 'license.expired', 'License expired', 'Your Texas DPS license has expired. Upload the renewed license to accept shifts again.', '{}'::jsonb, 'email');
      expired := expired + 1;
    elsif days <= 3 and not r.warned_3 then
      update public.officer_licenses set warned_3 = true where id = r.id;
      perform private.notify(r.officer_id, 'license.expiring', 'License expires in 3 days', 'Renew your Texas DPS license now to keep accepting shifts.', '{}'::jsonb, 'push');
      warned := warned + 1;
    elsif days <= 14 and not r.warned_14 then
      update public.officer_licenses set warned_14 = true where id = r.id;
      perform private.notify(r.officer_id, 'license.expiring', 'License expires in 14 days', 'Renew your Texas DPS license and upload the new card in Profile.', '{}'::jsonb, 'push');
      warned := warned + 1;
    elsif days <= 30 and not r.warned_30 then
      update public.officer_licenses set warned_30 = true where id = r.id;
      perform private.notify(r.officer_id, 'license.expiring', 'License expires in 30 days', 'Your Texas DPS license expires soon. Start the renewal now.', '{}'::jsonb, 'push');
      warned := warned + 1;
    end if;
  end loop;
  return jsonb_build_object('warned', warned, 'expired', expired);
end;
$$;

-- Nightly sweep of deactivation thresholds.
create or replace function private.run_deactivation_checks()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  n integer := 0;
begin
  for r in select user_id from public.officer_profiles where account_status = 'active' loop
    if private.run_deactivation_check(r.user_id) then n := n + 1; end if;
  end loop;
  return n;
end;
$$;

-- Reminders 24 h and 2 h before start for confirmed officers.
create or replace function private.queue_shift_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select sh.id, sh.title, sh.start_at, sh.reminder_24h_sent, sh.reminder_2h_sent, st.name as site_name
    from public.shifts sh join public.sites st on st.id = sh.site_id
    where sh.status in ('open', 'filled') and sh.start_at > now()
      and ((not sh.reminder_24h_sent and sh.start_at <= now() + interval '24 hours')
        or (not sh.reminder_2h_sent and sh.start_at <= now() + interval '2 hours'))
    for update of sh skip locked
  loop
    if not r.reminder_2h_sent and r.start_at <= now() + interval '2 hours' then
      update public.shifts set reminder_2h_sent = true, reminder_24h_sent = true where id = r.id;
      perform private.notify(a.officer_id, 'shift.reminder', 'Shift in 2 hours', format('%s at %s starts at %s. Clock in opens 15 minutes before.', r.title, r.site_name, to_char(r.start_at at time zone 'America/Chicago', 'HH12:MI AM')), jsonb_build_object('shift_id', r.id))
        from public.assignments a where a.shift_id = r.id and a.status = 'confirmed';
    else
      update public.shifts set reminder_24h_sent = true where id = r.id;
      perform private.notify(a.officer_id, 'shift.reminder', 'Shift tomorrow', format('%s at %s starts %s.', r.title, r.site_name, to_char(r.start_at at time zone 'America/Chicago', 'Dy HH12:MI AM')), jsonb_build_object('shift_id', r.id))
        from public.assignments a where a.shift_id = r.id and a.status = 'confirmed';
    end if;
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Location pings older than the retention window are deleted.
create or replace function private.prune_location_pings()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  days integer := private.setting_int('location_ping_retention_days', 90);
  n integer;
begin
  delete from public.location_pings where recorded_at < now() - make_interval(days => days);
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Close out shifts whose window has passed with nobody still clocked in.
create or replace function private.close_finished_shifts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  perform private.begin_internal();
  update public.shifts sh set status = 'completed'
  where sh.status in ('in_progress', 'filled') and sh.end_at < now() - interval '1 hour'
    and not exists (select 1 from public.assignments a where a.shift_id = sh.id and a.status = 'clocked_in');
  get diagnostics n = row_count;
  update public.shifts sh set status = 'cancelled', cancelled_at = now(), cancel_reason = 'unfilled'
  where sh.status = 'open' and sh.end_at < now()
    and not exists (select 1 from public.assignments a where a.shift_id = sh.id and a.status in ('confirmed', 'clocked_in', 'completed'));
  return n;
end;
$$;

-- Admin dashboard numbers in one call.
create or replace function public.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  week_start timestamptz := date_trunc('week', now());
  mrr integer;
begin
  if not private.is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  select coalesce(sum(p.price_cents), 0) into mrr from public.companies c join public.plans p on p.id = c.plan_id where c.subscription_status = 'active';
  return jsonb_build_object(
    'officers_by_status', (select coalesce(jsonb_object_agg(account_status, cnt), '{}'::jsonb) from (select account_status, count(*) cnt from public.officer_profiles group by 1) s),
    'licenses_pending', (select count(*) from public.officer_licenses where status = 'pending'),
    'companies_by_plan', (select coalesce(jsonb_object_agg(coalesce(p.code::text, 'none'), cnt), '{}'::jsonb) from (select c.plan_id, count(*) cnt from public.companies c group by 1) s left join public.plans p on p.id = s.plan_id),
    'shifts_this_week', (select count(*) from public.shifts where start_at >= week_start and start_at < week_start + interval '7 days' and status <> 'draft'),
    'fill_rate_pct', (select case when count(*) = 0 then null else round(100.0 * count(*) filter (where status in ('filled', 'in_progress', 'completed')) / count(*)) end
                      from public.shifts where start_at >= now() - interval '30 days' and status in ('open', 'filled', 'in_progress', 'completed', 'cancelled')),
    'gross_volume_cents_30d', (select coalesce(sum(total_cents), 0) from public.payments where created_at >= now() - interval '30 days' and status in ('authorized', 'captured', 'paid_out', 'partially_refunded')),
    'platform_fees_cents_30d', (select coalesce(sum(platform_fee_cents), 0) from public.payments where created_at >= now() - interval '30 days' and status in ('captured', 'paid_out', 'partially_refunded')),
    'mrr_cents', mrr,
    'open_disputes', (select count(*) from public.disputes where status = 'open'),
    'incidents_7d', (select count(*) from public.incident_reports where created_at >= now() - interval '7 days'),
    'waitlist_new', (select count(*) from public.waitlist_leads where status = 'new')
  );
end;
$$;
