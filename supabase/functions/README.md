# Edge Functions

Deno functions that sit between the apps, the SQL RPCs and Stripe / Expo / Resend / Twilio.
Every money or state change in the marketplace happens inside a SQL RPC (see
`supabase/migrations/20261021000400_functions_marketplace.sql`); a function calls the RPC with the
caller's JWT, then performs the external side effect (charge, transfer, refund, push, email).

Request/response contracts live in `packages/shared/src/api.ts` (`EDGE_FUNCTIONS`); fee and payout
math in `packages/shared/src/money.ts`. Both are imported directly via the `@shared/` import map in
`deno.json`, so the functions and the apps can never drift apart.

## Functions

| Function | Who calls it | Auth | What it does |
| --- | --- | --- | --- |
| `create-signup-fee-checkout` | Officer app | user JWT (officer) | Stripe Checkout (`mode: payment`) for the one-time signup fee (`platform_settings.signup_fee_cents`, default $30). |
| `create-subscription-checkout` | Employer web | user JWT (owner) | Creates/reuses the Stripe customer and opens Checkout (`mode: subscription`, card always collected, pilot trial from `pilot_trial_days`). |
| `create-billing-portal-session` | Employer web | user JWT (owner) | Stripe Billing Portal link (update card, cancel, invoices). |
| `create-connect-onboarding-link` | Officer app | user JWT (officer) | Creates the Stripe Connect Express account on first call and returns an onboarding link + `payouts_enabled`. |
| `accept-shift` | Officer app | user JWT (officer) | RPC `accept_shift`; on an auto-fill booking charges the employer's saved card for the shift total. |
| `confirm-applicant` | Employer web | user JWT (owner/manager/admin) | RPC `confirm_applicant`; charges the employer's saved card (officer pay + platform fee). |
| `clock-in` | Officer app | user JWT (officer) | RPC `clock_in` (geofence, early window, override). |
| `clock-out` | Officer app | user JWT (officer) | RPC `clock_out`. |
| `approve-timesheet` | Employer web | user JWT (owner/manager/admin) | RPC `approve_timesheet`, then Connect transfer for approved minutes + employer refund for the rest. |
| `cash-out-instant` | Officer app | user JWT (officer) | Stripe Instant Payout from the connected account; gated by `platform_settings.instant_payouts_enabled` and `officer_profiles.instant_payouts_enabled`. |
| `send-push` | pg_cron (every minute) | service-role bearer | Drains `push_queue`: Expo push, SMS (Twilio or console), email (Resend). Deletes dead Expo tokens. |
| `match-and-notify` | Internal job, admin, or the shift's company owner | service-role bearer or user JWT | RPC `match_candidates`, notifies up to 50 officers (push, plus SMS when the shift is urgent). |
| `stripe-webhook` | Stripe | `Stripe-Signature` | Idempotent (`stripe_events`) handler for checkout, subscriptions, payment methods, Connect account status, shift charges and refunds. |
| `reconcile-payments` | pg_cron (every 10 min) or admin | service-role bearer or admin JWT | Refunds cancelled/no-show charges, settles approved (incl. auto-approved) timesheets, retries failed charges after the card is updated. |
| `invite-manager` | Employer web | user JWT (owner) | Checks seat capacity, creates a `company_invites` row, emails `${APP_URL}/invite/<token>`. |
| `background-check` | Officer app / admin panel | user JWT | `start` / `status` / `manual_set` (admin) through the provider abstraction (`manual` or `checkr` stub). |

`stripe-webhook`, `send-push` and `reconcile-payments` are deployed with `verify_jwt = false`
(see `supabase/config.toml`) because they authenticate themselves: a Stripe signature or a
constant-time comparison of the bearer token with the service-role key.

### Money flow

1. **Confirmation** (`accept-shift` auto-fill or `confirm-applicant`): PaymentIntent for
   `payments.total_cents` (officer pay + platform fee for the scheduled minutes) on the company's
   `default_payment_method_id`, `off_session`, confirmed and captured immediately,
   `transfer_group = assignment_id`. Success: `payments.status = 'captured'`. Decline:
   `status = 'failed'` + `failure_message`, company notified; the assignment stays and
   `reconcile-payments` retries once the card changes (or after 12 h).
2. **Approval** (`approve-timesheet`, or cron auto-approval picked up by `reconcile-payments`):
   `computeSettlement()` from `@shared/money.ts`; `transfers.create` to the officer's Connect account
   with `source_transaction = stripe_charge_id`; `refunds.create` for unapproved minutes (pay + fee).
   The fee on approved pay stays in the platform balance. Officers without payouts enabled are
   nudged to connect; the transfer is retried by the reconciler.
3. **Cancellation / no-show**: SQL sets `payments.status = 'canceled'`; the reconciler issues the
   full refund and sets `'refunded'`.

### Guarded columns

`companies` billing columns and `officer_profiles` verification/payout columns are protected by
BEFORE UPDATE triggers that only yield when the transaction-local GUC `shiftshield.internal` is on.
Triggers fire for the service role too, so those writes go through `_shared/db.ts`
(`internalUpdate`), which opens one transaction on `SUPABASE_DB_URL`, sets the GUC and updates.
Everything else uses supabase-js.

## Layout

```
supabase/functions/
  deno.json                 import map (@shared/ -> packages/shared/src), strict compiler options
  .env.example              every secret the functions read
  _shared/
    supabase.ts             userClient / serviceClient / requireUser (claims from the verified JWT)
    stripe.ts               Stripe client (pinned API version, fetch HTTP client)
    http.ts                 serve() wrapper: CORS, method check, error mapping, readJson(zod)
    errors.ts               HttpError + PostgREST -> ApiError mapping (409 for SQL business errors)
    db.ts                   internalUpdate() for guarded columns
    notify.ts               notifications + push_queue inserts (mirror of private.notify)
    settings.ts             platform_settings readers
    payments.ts             chargeAssignment / settleAssignment / refundCanceledPayment
    background-check.ts     provider interface, ManualProvider, CheckrProvider stub
    sms.ts / email.ts / expo.ts   delivery providers
    validation.ts           shared zod schemas
  <function-name>/index.ts  one folder per function
```

## Local development

```bash
supabase start                                   # db + auth + studio + edge runtime
supabase db reset                                # apply migrations + seed.sql
cp supabase/functions/.env.example supabase/functions/.env   # fill in test keys
supabase functions serve --env-file supabase/functions/.env  # http://localhost:54321/functions/v1/<name>
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook
```

Type-check without installing Deno globally:

```bash
npx -y deno@2 check supabase/functions/**/index.ts
```

## Deploy

```bash
# secrets (once per environment)
supabase secrets set --env-file supabase/functions/.env

# all functions
supabase functions deploy

# one function
supabase functions deploy stripe-webhook --no-verify-jwt
supabase functions deploy send-push --no-verify-jwt
supabase functions deploy reconcile-payments --no-verify-jwt
supabase functions deploy accept-shift
```

After deploying, register the Stripe webhook endpoint at
`https://<project-ref>.supabase.co/functions/v1/stripe-webhook` for these events:
`checkout.session.completed`, `checkout.session.async_payment_succeeded`,
`customer.subscription.created|updated|deleted`, `invoice.payment_failed`, `customer.updated`,
`payment_method.attached`, `account.updated` (Connect), `payment_intent.succeeded`,
`payment_intent.payment_failed`, `charge.refunded`. Put its signing secret in `STRIPE_WEBHOOK_SECRET`.

pg_cron needs the project URL and service-role key in Vault so it can call `send-push` and
`reconcile-payments` (see `20261021000800_cron.sql`):

```sql
select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
select vault.create_secret('<service-role-key>', 'service_role_key');
```

## Error contract

All functions return `ApiResponse<T>`. Errors are `{ error: { code, message, details? } }`:

| HTTP | `code` | When |
| --- | --- | --- |
| 400 | `invalid_request`, `invalid_json`, `invalid_signature` | zod validation, bad JSON, bad Stripe signature |
| 401 | `unauthorized` | missing/expired JWT |
| 403 | `not_authorized` | wrong role / not your company / internal-only endpoint |
| 404 | `*_not_found` | missing rows |
| 409 | SQL business code (`shift_full`, `officer_overlap`, `plan_cap_seats`, ...) or function-specific (`card_declined`, `already_paid`, `payouts_not_enabled`) | rule violations; `message` is the SQL `detail` text |
| 500 | `internal_error` | anything unexpected (details only in logs) |
