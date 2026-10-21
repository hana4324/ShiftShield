-- Row Level Security on every table. Rules:
--  * Officers read only their own private data plus open shifts (and shifts they are involved in).
--  * Employers read only their company's data and the public profile of officers who applied / are booked.
--  * Employers see live location only for assignments clocked in at their sites.
--  * License images are private storage; only the owner and admins get signed URLs (see storage migration).
--  * Admin access goes through the admin JWT claim (private.is_admin()).
--  * Money and state changes happen in security-definer functions; clients only write "safe" columns.

-- ---------- profiles ----------
alter table public.profiles enable row level security;
create policy "profiles: self read" on public.profiles for select to authenticated
  using (id = private.uid() or private.is_admin());
create policy "profiles: self update" on public.profiles for update to authenticated
  using (id = private.uid()) with check (id = private.uid() and role = (select p.role from public.profiles p where p.id = private.uid()));
create policy "profiles: company members see each other" on public.profiles for select to authenticated
  using (private.is_employer() and id in (select user_id from public.company_members where company_id = private.jwt_company_id()));
create policy "profiles: employer sees involved officers" on public.profiles for select to authenticated
  using (private.is_employer() and private.company_can_view_officer(private.jwt_company_id(), id));
create policy "profiles: officer sees employer team on own shifts" on public.profiles for select to authenticated
  using (private.is_officer() and id in (
    select cm.user_id from public.company_members cm
    join public.shifts sh on sh.company_id = cm.company_id
    where private.officer_involved_in_shift(sh.id)));
create policy "profiles: admin update" on public.profiles for update to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- ---------- license_types ----------
alter table public.license_types enable row level security;
create policy "license_types: anyone authenticated reads" on public.license_types for select to authenticated using (true);
create policy "license_types: admin writes" on public.license_types for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- ---------- officer_profiles ----------
alter table public.officer_profiles enable row level security;
create policy "officer_profiles: self read" on public.officer_profiles for select to authenticated
  using (user_id = private.uid() or private.is_admin());
create policy "officer_profiles: self insert" on public.officer_profiles for insert to authenticated
  with check (user_id = private.uid() and private.is_officer());
-- Officers may edit only non-privileged columns; the trigger below blocks the rest.
create policy "officer_profiles: self update" on public.officer_profiles for update to authenticated
  using (user_id = private.uid()) with check (user_id = private.uid());
create policy "officer_profiles: admin update" on public.officer_profiles for update to authenticated
  using (private.is_admin()) with check (private.is_admin());
create policy "officer_profiles: employer sees involved officers" on public.officer_profiles for select to authenticated
  using (private.is_employer() and private.company_can_view_officer(private.jwt_company_id(), user_id));

create or replace function private.guard_officer_profile_update()
returns trigger
language plpgsql
as $$
begin
  if private.is_internal() then
    return new;
  end if;
  -- Officers cannot grant themselves verification, payouts, ratings or status.
  new.signup_fee_paid_at := old.signup_fee_paid_at;
  new.signup_fee_checkout_session_id := old.signup_fee_checkout_session_id;
  new.background_status := old.background_status;
  new.background_provider := old.background_provider;
  new.background_reference := old.background_reference;
  new.background_updated_at := old.background_updated_at;
  new.account_status := old.account_status;
  new.status_reason := old.status_reason;
  new.rating_avg := old.rating_avg;
  new.rating_count := old.rating_count;
  new.completed_shifts := old.completed_shifts;
  new.no_show_count := old.no_show_count;
  new.late_cancel_count := old.late_cancel_count;
  new.stripe_account_id := old.stripe_account_id;
  new.payouts_enabled := old.payouts_enabled;
  new.instant_payouts_enabled := old.instant_payouts_enabled;
  new.deactivated_at := old.deactivated_at;
  return new;
end;
$$;
create trigger officer_profiles_guard before update on public.officer_profiles
  for each row execute function private.guard_officer_profile_update();

-- ---------- officer_licenses ----------
alter table public.officer_licenses enable row level security;
create policy "officer_licenses: owner read" on public.officer_licenses for select to authenticated
  using (officer_id = private.uid() or private.is_admin());
create policy "officer_licenses: owner insert" on public.officer_licenses for insert to authenticated
  with check (officer_id = private.uid() and status = 'pending');
create policy "officer_licenses: owner resubmit while pending/rejected" on public.officer_licenses for update to authenticated
  using (officer_id = private.uid() and status in ('pending', 'rejected'))
  with check (officer_id = private.uid() and status = 'pending');
create policy "officer_licenses: admin all" on public.officer_licenses for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- ---------- officer_certifications ----------
alter table public.officer_certifications enable row level security;
create policy "officer_certifications: owner all" on public.officer_certifications for all to authenticated
  using (officer_id = private.uid() or private.is_admin()) with check (officer_id = private.uid() or private.is_admin());

-- ---------- plans ----------
alter table public.plans enable row level security;
create policy "plans: public read" on public.plans for select to anon, authenticated using (is_active or private.is_admin());
create policy "plans: admin writes" on public.plans for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- ---------- companies ----------
alter table public.companies enable row level security;
create policy "companies: members read" on public.companies for select to authenticated
  using (id = private.jwt_company_id() or private.is_admin());
create policy "companies: owner creates" on public.companies for insert to authenticated
  with check (created_by = private.uid() and private.jwt_role() = 'employer_owner');
create policy "companies: owner updates" on public.companies for update to authenticated
  using (id = private.jwt_company_id() and private.jwt_role() = 'employer_owner')
  with check (id = private.jwt_company_id());
create policy "companies: admin update" on public.companies for update to authenticated
  using (private.is_admin()) with check (private.is_admin());
-- Officers may read the name/type of companies whose shifts they can see (through the view below).

create or replace function private.guard_company_update()
returns trigger
language plpgsql
as $$
begin
  if private.is_internal() then
    return new;
  end if;
  -- Billing state is owned by Stripe webhooks / admins.
  new.plan_id := old.plan_id;
  new.stripe_customer_id := old.stripe_customer_id;
  new.stripe_subscription_id := old.stripe_subscription_id;
  new.subscription_status := old.subscription_status;
  new.current_period_start := old.current_period_start;
  new.current_period_end := old.current_period_end;
  new.default_payment_method_id := old.default_payment_method_id;
  new.is_pilot := old.is_pilot;
  new.pilot_ends_at := old.pilot_ends_at;
  return new;
end;
$$;
create trigger companies_guard before update on public.companies
  for each row execute function private.guard_company_update();

-- ---------- company_members ----------
alter table public.company_members enable row level security;
create policy "company_members: members read" on public.company_members for select to authenticated
  using (company_id = private.jwt_company_id() or user_id = private.uid() or private.is_admin());
create policy "company_members: owner manages" on public.company_members for all to authenticated
  using ((company_id = private.jwt_company_id() and private.jwt_role() = 'employer_owner') or private.is_admin())
  with check ((company_id = private.jwt_company_id() and private.jwt_role() = 'employer_owner') or private.is_admin());

-- ---------- company_invites ----------
alter table public.company_invites enable row level security;
create policy "company_invites: owner manages" on public.company_invites for all to authenticated
  using ((company_id = private.jwt_company_id() and private.jwt_role() = 'employer_owner') or private.is_admin())
  with check ((company_id = private.jwt_company_id() and private.jwt_role() = 'employer_owner') or private.is_admin());

-- ---------- sites ----------
alter table public.sites enable row level security;
create policy "sites: company all" on public.sites for all to authenticated
  using (company_id = private.jwt_company_id() or private.is_admin())
  with check (company_id = private.jwt_company_id() or private.is_admin());
create policy "sites: officers see sites of visible shifts" on public.sites for select to authenticated
  using (private.is_officer() and exists (
    select 1 from public.shifts sh where sh.site_id = sites.id
      and (sh.status = 'open' or private.officer_involved_in_shift(sh.id))));

-- ---------- platform_settings ----------
alter table public.platform_settings enable row level security;
create policy "platform_settings: authenticated read" on public.platform_settings for select to authenticated using (true);
create policy "platform_settings: admin writes" on public.platform_settings for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- ---------- user_agreements ----------
alter table public.user_agreements enable row level security;
create policy "user_agreements: self" on public.user_agreements for select to authenticated
  using (user_id = private.uid() or private.is_admin());
create policy "user_agreements: self insert" on public.user_agreements for insert to authenticated
  with check (user_id = private.uid());

-- ---------- audit_log ----------
alter table public.audit_log enable row level security;
create policy "audit_log: admin read" on public.audit_log for select to authenticated using (private.is_admin());

-- ---------- push_tokens ----------
alter table public.push_tokens enable row level security;
create policy "push_tokens: self all" on public.push_tokens for all to authenticated
  using (user_id = private.uid()) with check (user_id = private.uid());

-- ---------- notifications ----------
alter table public.notifications enable row level security;
create policy "notifications: self read" on public.notifications for select to authenticated using (user_id = private.uid());
create policy "notifications: self mark read" on public.notifications for update to authenticated
  using (user_id = private.uid()) with check (user_id = private.uid());

-- ---------- push_queue (service role only) ----------
alter table public.push_queue enable row level security;
create policy "push_queue: admin read" on public.push_queue for select to authenticated using (private.is_admin());

-- ---------- shifts ----------
alter table public.shifts enable row level security;
create policy "shifts: company reads own" on public.shifts for select to authenticated
  using (company_id = private.jwt_company_id() or private.is_admin());
create policy "shifts: company inserts drafts" on public.shifts for insert to authenticated
  with check (company_id = private.jwt_company_id() and private.is_employer() and status = 'draft' and created_by = private.uid());
create policy "shifts: company edits drafts/open" on public.shifts for update to authenticated
  using (company_id = private.jwt_company_id() and private.is_employer() and status in ('draft', 'open'))
  with check (company_id = private.jwt_company_id() and status in ('draft', 'open'));
create policy "shifts: company deletes drafts" on public.shifts for delete to authenticated
  using (company_id = private.jwt_company_id() and private.is_employer() and status = 'draft');
create policy "shifts: admin update" on public.shifts for update to authenticated
  using (private.is_admin()) with check (private.is_admin());
create policy "shifts: officers see open or involved" on public.shifts for select to authenticated
  using (private.is_officer() and (status = 'open' or private.officer_involved_in_shift(id)));

-- Publishing is a function (tier checks), not a direct status update.
create or replace function private.guard_shift_update()
returns trigger
language plpgsql
as $$
begin
  if private.is_internal() then
    return new;
  end if;
  if new.status is distinct from old.status then
    raise exception 'Use publish_shift / cancel_shift to change shift status' using errcode = '42501';
  end if;
  if old.status = 'open' and (new.hourly_rate_cents <> old.hourly_rate_cents or new.start_at <> old.start_at or new.end_at <> old.end_at) then
    raise exception 'Rate and times are locked once a shift is open' using errcode = '42501';
  end if;
  new.published_at := old.published_at;
  new.reminder_24h_sent := old.reminder_24h_sent;
  new.reminder_2h_sent := old.reminder_2h_sent;
  return new;
end;
$$;
create trigger shifts_guard before update on public.shifts for each row execute function private.guard_shift_update();

-- ---------- shift_applications ----------
alter table public.shift_applications enable row level security;
create policy "shift_applications: officer own" on public.shift_applications for select to authenticated
  using (officer_id = private.uid() or private.is_admin());
create policy "shift_applications: company sees applicants" on public.shift_applications for select to authenticated
  using (private.is_employer() and shift_id in (select id from public.shifts where company_id = private.jwt_company_id()));
-- Inserts/decisions go through accept_shift / confirm_applicant / decline_applicant / withdraw_application.

-- ---------- assignments ----------
alter table public.assignments enable row level security;
create policy "assignments: officer own" on public.assignments for select to authenticated
  using (officer_id = private.uid() or private.is_admin());
create policy "assignments: company sees own shifts" on public.assignments for select to authenticated
  using (private.is_employer() and shift_id in (select id from public.shifts where company_id = private.jwt_company_id()));
-- All writes via functions.

-- ---------- location_pings ----------
alter table public.location_pings enable row level security;
create policy "location_pings: officer own" on public.location_pings for select to authenticated
  using (assignment_id in (select id from public.assignments where officer_id = private.uid()) or private.is_admin());
create policy "location_pings: employer only while clocked in at own site" on public.location_pings for select to authenticated
  using (private.is_employer() and assignment_id in (
    select a.id from public.assignments a
    join public.shifts sh on sh.id = a.shift_id
    where sh.company_id = private.jwt_company_id() and a.status = 'clocked_in'));
-- Inserts via record_location_ping.

-- ---------- payments ----------
alter table public.payments enable row level security;
create policy "payments: company read" on public.payments for select to authenticated
  using (company_id = private.jwt_company_id() or private.is_admin());
create policy "payments: officer reads own pay" on public.payments for select to authenticated
  using (officer_id = private.uid());

-- ---------- ratings ----------
alter table public.ratings enable row level security;
create policy "ratings: participants read" on public.ratings for select to authenticated
  using (rater_id = private.uid() or ratee_id = private.uid() or private.is_admin()
    or (private.is_employer() and assignment_id in (
      select a.id from public.assignments a join public.shifts sh on sh.id = a.shift_id where sh.company_id = private.jwt_company_id())));
-- Inserts via rate_assignment.

-- ---------- strikes ----------
alter table public.strikes enable row level security;
create policy "strikes: officer own" on public.strikes for select to authenticated
  using (officer_id = private.uid() or private.is_admin());

-- ---------- disputes ----------
alter table public.disputes enable row level security;
create policy "disputes: participants read" on public.disputes for select to authenticated
  using (private.is_admin()
    or assignment_id in (select id from public.assignments where officer_id = private.uid())
    or (private.is_employer() and assignment_id in (
      select a.id from public.assignments a join public.shifts sh on sh.id = a.shift_id where sh.company_id = private.jwt_company_id())));
create policy "disputes: admin update" on public.disputes for update to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- ---------- incident_reports ----------
alter table public.incident_reports enable row level security;
create policy "incident_reports: officer own" on public.incident_reports for select to authenticated
  using (officer_id = private.uid() or private.is_admin());
create policy "incident_reports: company read" on public.incident_reports for select to authenticated
  using (company_id = private.jwt_company_id());
create policy "incident_reports: company acknowledges" on public.incident_reports for update to authenticated
  using (company_id = private.jwt_company_id() and private.is_employer())
  with check (company_id = private.jwt_company_id());

-- ---------- message_threads / messages ----------
alter table public.message_threads enable row level security;
create policy "message_threads: company" on public.message_threads for select to authenticated
  using (company_id = private.jwt_company_id() or private.is_admin());
create policy "message_threads: booked officers" on public.message_threads for select to authenticated
  using (private.is_officer() and shift_id in (
    select shift_id from public.assignments where officer_id = private.uid() and status in ('confirmed', 'clocked_in', 'completed')));

alter table public.messages enable row level security;
create policy "messages: thread participants read" on public.messages for select to authenticated
  using (private.is_admin() or thread_id in (
    select t.id from public.message_threads t
    where t.company_id = private.jwt_company_id()
       or (private.is_officer() and t.shift_id in (
         select shift_id from public.assignments where officer_id = private.uid() and status in ('confirmed', 'clocked_in', 'completed')))));
create policy "messages: participants write" on public.messages for insert to authenticated
  with check (sender_id = private.uid() and thread_id in (
    select t.id from public.message_threads t
    where t.company_id = private.jwt_company_id()
       or (private.is_officer() and t.shift_id in (
         select shift_id from public.assignments where officer_id = private.uid() and status in ('confirmed', 'clocked_in')))));

-- ---------- saved_shifts ----------
alter table public.saved_shifts enable row level security;
create policy "saved_shifts: officer own" on public.saved_shifts for all to authenticated
  using (officer_id = private.uid()) with check (officer_id = private.uid());

-- ---------- stripe_events (service role only) ----------
alter table public.stripe_events enable row level security;
create policy "stripe_events: admin read" on public.stripe_events for select to authenticated using (private.is_admin());

-- ---------- waitlist_leads already has RLS (Phase 0) ----------

-- Company name/type visible to officers for shifts they can see.
create or replace view public.shift_company_cards
with (security_invoker = true)
as
select sh.id as shift_id, c.id as company_id, c.name as company_name, c.type as company_type, c.logo_path
from public.shifts sh
join public.companies c on c.id = sh.company_id;

grant select on public.shift_company_cards to authenticated;
grant select on public.officer_public_profiles to authenticated;

-- The view runs as invoker, but companies RLS would hide the company row from officers.
-- Expose the two columns officers need through a definer function instead.
create or replace function public.company_card(p_company_id uuid)
returns table (company_id uuid, company_name text, company_type public.company_type, logo_path text)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.name, c.type, c.logo_path
  from public.companies c
  where c.id = p_company_id
    and (c.id = private.jwt_company_id() or private.is_admin()
      or exists (select 1 from public.shifts sh where sh.company_id = c.id and (sh.status = 'open' or private.officer_involved_in_shift(sh.id))));
$$;
