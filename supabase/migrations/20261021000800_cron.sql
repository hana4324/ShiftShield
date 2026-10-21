-- pglite:skip-file
-- Scheduled jobs. pg_cron runs inside the database; the push drain calls the send-push Edge Function
-- through pg_net using the project URL + service role key stored in Vault
-- (supabase secrets: `select vault.create_secret('<url>', 'project_url')`, `vault.create_secret('<key>', 'service_role_key')`).

create extension if not exists pg_net with schema extensions;

create or replace function private.invoke_edge_function(p_name text, p_body jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  url text := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url' limit 1);
  key text := (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key' limit 1);
begin
  if url is null or key is null then
    raise notice 'invoke_edge_function: vault secrets project_url / service_role_key are not set';
    return;
  end if;
  perform net.http_post(
    url := url || '/functions/v1/' || p_name,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || key),
    body := p_body
  );
end;
$$;

select cron.schedule('shiftshield-mark-no-shows', '*/5 * * * *', $$select private.mark_no_shows()$$);
select cron.schedule('shiftshield-shift-reminders', '*/5 * * * *', $$select private.queue_shift_reminders()$$);
select cron.schedule('shiftshield-auto-approve', '0 * * * *', $$select private.auto_approve_timesheets()$$);
select cron.schedule('shiftshield-close-shifts', '15 * * * *', $$select private.close_finished_shifts()$$);
select cron.schedule('shiftshield-license-expiry', '0 9 * * *', $$select private.process_license_expiry()$$);
select cron.schedule('shiftshield-deactivation', '30 3 * * *', $$select private.run_deactivation_checks()$$);
select cron.schedule('shiftshield-prune-pings', '0 4 * * *', $$select private.prune_location_pings()$$);
select cron.schedule('shiftshield-drain-push', '* * * * *', $$select private.invoke_edge_function('send-push')$$);
select cron.schedule('shiftshield-reconcile-payments', '*/10 * * * *', $$select private.invoke_edge_function('reconcile-payments')$$);
