-- ShiftShield seed: reference data (always) + Dallas-Fort Worth demo data (local / staging).
-- Reference rows use ON CONFLICT so the file is safe to re-run.

-- ---------- License types (Texas DPS Private Security Program) ----------
insert into public.license_types (state, code, name, level, armed, description) values
  ('TX', 'TX_L2', 'Level II: Non-Commissioned Security Officer', 2, false, 'Unarmed security officer.'),
  ('TX', 'TX_L3', 'Level III: Commissioned Security Officer', 3, true, 'Armed security officer (commissioned).'),
  ('TX', 'TX_L4', 'Level IV: Personal Protection Officer', 4, true, 'Personal protection officer (requires Level III).')
on conflict (code) do update set name = excluded.name, level = excluded.level, armed = excluded.armed;

-- ---------- Plans (defaults; admin-editable, see OPEN_QUESTIONS.md) ----------
insert into public.plans (code, name, price_cents, monthly_booking_cap, monthly_shift_cap, min_lead_time_minutes, max_sites, max_seats, fee_bps, daily_pay_enabled, priority_rank, features) values
  ('essential', 'Essential', 19900, 15, 15, 1440, 1, 1, 1000, false, 0, '{"reports":"none","priority_matching":"none","review_or_auto_fill":true,"live_map":true}'),
  ('pro', 'Pro', 49900, 40, 40, 240, 5, 5, 1000, false, 1, '{"reports":"csv","priority_matching":"high","review_or_auto_fill":true,"live_map":true}'),
  ('enterprise', 'Enterprise', 129900, null, null, 0, null, null, 800, true, 2, '{"reports":"csv_analytics","priority_matching":"highest","review_or_auto_fill":true,"live_map":true}')
on conflict (code) do update set name = excluded.name, price_cents = excluded.price_cents, monthly_booking_cap = excluded.monthly_booking_cap,
  monthly_shift_cap = excluded.monthly_shift_cap, min_lead_time_minutes = excluded.min_lead_time_minutes, max_sites = excluded.max_sites,
  max_seats = excluded.max_seats, fee_bps = excluded.fee_bps, daily_pay_enabled = excluded.daily_pay_enabled, priority_rank = excluded.priority_rank, features = excluded.features;

-- ---------- Platform settings ----------
insert into public.platform_settings (key, value, description) values
  ('signup_fee_cents', '3000', 'One-time officer signup fee (covers background check).'),
  ('geofence_radius_m', '150', 'Default site geofence radius in meters.'),
  ('location_ping_interval_sec', '300', 'Seconds between location pings while clocked in.'),
  ('clock_in_early_minutes', '15', 'Minutes before start when clock-in opens.'),
  ('no_show_after_minutes', '30', 'Minutes after start before a confirmed officer is marked no-show.'),
  ('late_cancel_hours', '12', 'Cancelling under this many hours before start counts as a strike.'),
  ('auto_approve_hours', '24', 'Hours after clock-out before a timesheet auto-approves.'),
  ('deactivate_min_rating', '4.0', 'Deactivate when average rating falls below this after deactivate_min_rated_shifts.'),
  ('deactivate_min_rated_shifts', '10', 'Rated shifts required before the rating threshold applies.'),
  ('deactivate_no_shows_90d', '2', 'No-shows in 90 days that deactivate an officer.'),
  ('deactivate_late_cancels_90d', '3', 'Late cancellations in 90 days that deactivate an officer.'),
  ('location_ping_retention_days', '90', 'Location pings older than this are deleted.'),
  ('default_travel_radius_mi', '25', 'Default officer travel radius in miles.'),
  ('pilot_trial_days', '30', 'Trial length for pilot companies.')
on conflict (key) do nothing;

-- ---------- Waitlist demo leads (Phase 0) ----------
insert into public.waitlist_leads
  (kind, status, contact_name, email, phone, city, company_name, title, company_type, site_count, shifts_per_month, shift_types, coverage_timeline, notes, source)
values
  ('employer', 'new', 'Maria Lopez', 'maria@oakridgeseniorliving.example', '(214) 555-0142', 'Dallas', 'Oak Ridge Senior Living', 'Executive Director', 'senior_living', 2, 20, '{overnight,front_desk}', 'immediately', 'We lose about two overnight shifts a week to call-outs.', 'seed'),
  ('employer', 'contacted', 'Derrick Hall', 'dhall@lonestarprotective.example', '(817) 555-0188', 'Fort Worth', 'Lone Star Protective Services', 'Operations Manager', 'security_company', 6, 60, '{overnight,patrol,armed,emergency_fill}', 'within_2_weeks', 'Interested in Pro.', 'seed'),
  ('officer', 'new', 'James Whitfield', 'jwhitfield@example.com', '(469) 555-0121', 'Arlington', null, null, null, null, null, '{}', null, null, 'seed')
on conflict do nothing;
update public.waitlist_leads set license_level = 'level_3' where kind = 'officer' and email = 'jwhitfield@example.com';

-- ---------- Demo users (LOCAL / STAGING ONLY: creates auth.users rows with password "ShiftShield!demo1") ----------
-- Supabase local dev accepts rows inserted straight into auth.users. In production, create users through Auth.
do $$
#variable_conflict use_variable
declare
  pw text;
  admin_id uuid := '00000000-0000-4000-8000-000000000001';
  owner_id uuid := '00000000-0000-4000-8000-000000000002';
  marcus_id uuid := '00000000-0000-4000-8000-000000000003';
  james_id uuid := '00000000-0000-4000-8000-000000000004';
  tasha_id uuid := '00000000-0000-4000-8000-000000000005';
  company_id uuid := '00000000-0000-4000-8000-000000000100';
  site_oak uuid := '00000000-0000-4000-8000-000000000201';
  site_hosp uuid := '00000000-0000-4000-8000-000000000202';
  site_arl uuid := '00000000-0000-4000-8000-000000000203';
  site_add uuid := '00000000-0000-4000-8000-000000000204';
  site_plano uuid := '00000000-0000-4000-8000-000000000205';
  l2 uuid; l3 uuid;
  pro_plan uuid;
  today date := (now() at time zone 'America/Chicago')::date;
begin
  if to_regclass('auth.users') is null or to_regproc('extensions.crypt') is null then
    raise notice 'auth.users / pgcrypto not present; skipping demo users';
    return;
  end if;
  pw := extensions.crypt('ShiftShield!demo1', extensions.gen_salt('bf'));

  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    (admin_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@shiftshield.test', pw, now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Ashley Jackson","role":"admin"}', now(), now()),
    (owner_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'derrick@lonestar.test', pw, now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Derrick Hall","role":"employer_owner","phone":"(817) 555-0188"}', now(), now()),
    (marcus_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'marcus@officer.test', pw, now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Marcus Reed","role":"officer","phone":"(469) 555-0121"}', now(), now()),
    (james_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'james@officer.test', pw, now(), '{"provider":"email","providers":["email"]}', '{"full_name":"James Whitfield","role":"officer","phone":"(817) 555-0101"}', now(), now()),
    (tasha_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tasha@officer.test', pw, now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Tasha Garcia","role":"officer","phone":"(214) 555-0102"}', now(), now())
  on conflict (id) do nothing;

  -- The on_auth_user_created trigger created profiles; promote the admin (admin is only ever set by SQL or another admin).
  update public.profiles set role = 'admin' where id = admin_id;

  select id into l2 from public.license_types where code = 'TX_L2';
  select id into l3 from public.license_types where code = 'TX_L3';
  select id into pro_plan from public.plans where code = 'pro';

  -- Officers
  insert into public.officer_profiles (user_id, home_geo, home_city, home_zip, travel_radius_mi, is_available, is_18_plus, is_21_plus, signup_fee_paid_at, background_status, account_status, rating_avg, rating_count, completed_shifts)
  values
    (marcus_id, private.make_point(32.80, -96.80), 'Dallas, TX', '75204', 25, true, true, true, now() - interval '20 days', 'clear', 'active', 4.9, 38, 42),
    (james_id, private.make_point(32.735, -97.108), 'Arlington, TX', '76010', 30, true, true, true, now() - interval '40 days', 'clear', 'active', 4.8, 61, 73),
    (tasha_id, private.make_point(32.82, -96.75), 'Dallas, TX', '75206', 20, true, true, true, now() - interval '10 days', 'clear', 'active', 4.7, 22, 25)
  on conflict (user_id) do nothing;

  insert into public.officer_licenses (officer_id, license_type_id, license_number, expires_on, front_path, back_path, status, reviewed_by, reviewed_at)
  values
    (marcus_id, l3, 'TX-3-0482917', today + 300, marcus_id || '/front.jpg', marcus_id || '/back.jpg', 'approved', admin_id, now() - interval '19 days'),
    (james_id, l3, 'TX-3-0391102', today + 200, james_id || '/front.jpg', james_id || '/back.jpg', 'approved', admin_id, now() - interval '39 days'),
    (tasha_id, l2, 'TX-2-1184402', today + 400, tasha_id || '/front.jpg', tasha_id || '/back.jpg', 'approved', admin_id, now() - interval '9 days')
  on conflict do nothing;

  -- Company (Pro, in pilot)
  insert into public.companies (id, name, type, phone, billing_email, plan_id, subscription_status, current_period_start, current_period_end, is_pilot, pilot_ends_at, created_by)
  values (company_id, 'Lone Star Protective Services', 'security_company', '(817) 555-0188', 'billing@lonestar.test', pro_plan, 'trialing', date_trunc('month', now()), date_trunc('month', now()) + interval '1 month', true, now() + interval '30 days', owner_id)
  on conflict (id) do nothing;
  insert into public.company_members (company_id, user_id, role) values (company_id, owner_id, 'owner') on conflict do nothing;

  insert into public.sites (id, company_id, name, site_type, address, geo, geofence_radius_m, contact_name, contact_phone, post_orders) values
    (site_oak, company_id, 'Oak Ridge Senior Living', 'senior_living', '8200 Walnut Hill Ln, Dallas, TX 75231', private.make_point(32.879, -96.768), 150, 'Maria Lopez', '(214) 555-0142', 'Check in at the front desk. Hourly rounds of all three wings and the parking garage.'),
    (site_hosp, company_id, 'Methodist Central Hospital', 'hospital', '3500 Gaston Ave, Dallas, TX 75246', private.make_point(32.789, -96.78), 200, 'Charge Nurse, ER', '(214) 555-0177', 'Front desk and ER entrance. Screen visitors, issue badges.'),
    (site_arl, company_id, 'Arlington Expo Center', 'event', '1201 E Division St, Arlington, TX 76011', private.make_point(32.747, -97.085), 250, 'Event Ops, Gate B', '(817) 555-0188', 'Bag checks at Gate B. Radio check on arrival.'),
    (site_add, company_id, 'Addison Tower', 'corporate', '15601 Dallas Pkwy, Addison, TX 75001', private.make_point(32.961, -96.83), 150, 'Priya Natarajan', '(972) 555-0107', 'Lobby desk. Lock down after 8 PM, badge access only.'),
    (site_plano, company_id, 'Legacy West Retail Center', 'retail', '7500 Windrose Ave, Plano, TX 75024', private.make_point(33.079, -96.823), 200, 'Property Management', '(972) 555-0150', 'Weekend foot patrol of the promenade and garages.')
  on conflict (id) do nothing;

  -- Shifts (times in America/Chicago)
  insert into public.shifts (company_id, site_id, title, description, start_at, end_at, hourly_rate_cents, officers_needed, required_license_level, armed_required, requirements, fill_mode, is_urgent, status, created_by, published_at) values
    (company_id, site_oak, 'Night Security', 'Overnight unarmed officer for a 120-resident senior living community.', (today::text || ' 22:00')::timestamp at time zone 'America/Chicago', ((today + 1)::text || ' 06:00')::timestamp at time zone 'America/Chicago', 2600, 1, 2, false, '[{"key":"uniform","label":"Black polo, black pants"},{"key":"transport","label":"Own transportation"},{"key":"age","label":"Minimum age 21"}]', 'auto', false, 'open', owner_id, now() - interval '12 minutes'),
    (company_id, site_hosp, 'Front Desk Officer', 'ER front desk coverage. Visitor screening and badge issuance.', (today::text || ' 18:00')::timestamp at time zone 'America/Chicago', ((today + 1)::text || ' 02:00')::timestamp at time zone 'America/Chicago', 2800, 2, 2, false, '[{"key":"uniform","label":"White shirt, black pants"},{"key":"transport","label":"Own transportation"}]', 'review', true, 'open', owner_id, now() - interval '41 minutes'),
    (company_id, site_arl, 'Event Security', 'Concert at the Expo Center, 6,000 attendees.', ((today + 1)::text || ' 17:00')::timestamp at time zone 'America/Chicago', ((today + 2)::text || ' 01:00')::timestamp at time zone 'America/Chicago', 2400, 6, 2, false, '[{"key":"uniform","label":"Hi-vis vest provided"},{"key":"age","label":"Minimum age 21"}]', 'auto', false, 'open', owner_id, now() - interval '130 minutes'),
    (company_id, site_add, 'Corporate Office Building', 'Armed lobby officer for a Class A office tower.', (today::text || ' 19:00')::timestamp at time zone 'America/Chicago', ((today + 1)::text || ' 03:00')::timestamp at time zone 'America/Chicago', 3000, 1, 3, true, '[{"key":"uniform","label":"Suit or blazer, duty belt"},{"key":"age","label":"Minimum age 21"}]', 'review', false, 'open', owner_id, now() - interval '200 minutes'),
    (company_id, site_plano, 'Weekend Security', 'Saturday daytime foot patrol at an outdoor retail promenade.', ((today + 5)::text || ' 10:00')::timestamp at time zone 'America/Chicago', ((today + 5)::text || ' 18:00')::timestamp at time zone 'America/Chicago', 2500, 2, 2, false, '[{"key":"uniform","label":"Black polo, khakis"}]', 'auto', false, 'draft', owner_id, null)
  on conflict do nothing;

  insert into public.message_threads (shift_id, company_id) select sh.id, sh.company_id from public.shifts sh where sh.company_id = company_id and sh.status <> 'draft' on conflict do nothing;

  -- Applications for the review-mode shifts
  insert into public.shift_applications (shift_id, officer_id, status)
  select sh.id, tasha_id, 'applied' from public.shifts sh where sh.title = 'Front Desk Officer' and sh.company_id = company_id
  on conflict do nothing;
  insert into public.shift_applications (shift_id, officer_id, status)
  select sh.id, james_id, 'applied' from public.shifts sh where sh.title = 'Corporate Office Building' and sh.company_id = company_id
  on conflict do nothing;
end $$;
