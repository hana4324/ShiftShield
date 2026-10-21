# ShiftShield

**Coverage when you need it.** On-demand security staffing for Texas: a two-sided marketplace
connecting licensed security officers with businesses that need shift coverage. Launch market is
Dallas-Fort Worth.

> Verified. Trusted. Protected.

## Status

| Phase | Scope                                              | Status      |
| ----- | -------------------------------------------------- | ----------- |
| 0     | Landing page + pilot waitlist + `/admin/leads`     | **Done** (live: https://shiftshield-phi.vercel.app) |
| 1     | Clickable demo mobile app (Expo)                   | **Done** (Expo Go / EAS preview) |
| 2     | Real backend, auth, onboarding, subscriptions      | Not started |
| 3     | Core marketplace (posting, matching, clock in/out) | Not started |
| 4     | Money and trust (payouts, ratings, strikes)        | Not started |
| 5     | Launch readiness (EAS builds, store assets)        | Not started |

Decisions the client is still making live in [`OPEN_QUESTIONS.md`](./OPEN_QUESTIONS.md).

## Repo layout

```
shiftshield/
  apps/
    web/           # Next.js 16 (App Router): landing page, pilot waitlist, admin panel at /admin
    mobile/        # Expo SDK 58 + Expo Router: officer + employer experiences, demo mode with seeded DFW data
  packages/
    shared/        # TypeScript types, zod schemas, constants (plans, licenses, business), fee math, design tokens
  supabase/
    migrations/    # Postgres migrations (PostGIS, pg_cron, RLS)
    functions/     # Edge Functions (Phase 2+)
    seed.sql       # Dallas demo data
  OPEN_QUESTIONS.md
```

## Stack

pnpm workspaces + Turborepo, TypeScript strict everywhere. Web: Next.js (App Router, Cache
Components) + Tailwind v4 on Vercel. Backend: Supabase (Postgres + PostGIS, Auth, Storage,
Realtime, Edge Functions, pg_cron). Mobile: Expo + Expo Router (Phase 1). Payments: Stripe.
Email: Supabase Auth + Resend (optional). Tests: Vitest (shared), Playwright (web), pgTAP (RLS,
Phase 2).

## Prerequisites

- Node 20+ (tested on 24) and pnpm 10 (`npm i -g pnpm@10`)
- A Supabase project (free tier is fine) for the waitlist table
- Optional: Supabase CLI for local Postgres, Vercel CLI for deploys, a Resend account for lead emails

## Quick start (web)

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local   # fill in the values below
pnpm dev:web                                    # http://localhost:3000
```

The site runs with **no env vars at all**: forms validate and log leads to the server console in
development. To store leads and use the admin panel, set in `apps/web/.env.local`:

| Variable                     | Purpose                                                           |
| ---------------------------- | ----------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`       | Canonical URL (OG tags, sitemap)                                  |
| `NEXT_PUBLIC_SUPABASE_URL`   | Supabase project URL                                              |
| `SUPABASE_SERVICE_ROLE_KEY`  | Server-only key used by the waitlist server action and admin reads |
| `ADMIN_PASSWORD`             | Password for `/admin/login`                                       |
| `ADMIN_SESSION_SECRET`       | Signs the admin cookie (`openssl rand -hex 32`)                   |
| `RESEND_API_KEY`             | Optional: email Ashley on each new lead                           |
| `LEAD_NOTIFY_EMAIL`          | Where lead notifications go                                       |
| `RESEND_FROM_EMAIL`          | Verified sender, e.g. `ShiftShield <leads@yourdomain.com>`        |

### Database

Apply the migrations to your Supabase project. Either:

```bash
# Supabase CLI (recommended)
supabase link --project-ref <ref>
supabase db push
# optional demo leads
psql "$SUPABASE_DB_URL" -f supabase/seed.sql
```

or paste `supabase/migrations/*.sql` (in order) into the SQL editor in the Supabase dashboard.

The `waitlist_leads` table has RLS enabled with no anon access. Inserts come only from the server
action using the service role key; admins read via the `app_role = admin` JWT claim (wired in Phase 2).

### Admin panel

`/admin/leads` lists leads with search and kind/status filters, inline status updates
(new / contacted / pilot / declined), and **Export CSV**. Sign in at `/admin/login` with
`ADMIN_PASSWORD`. `/admin` is `noindex`, `no-store`, and excluded in `robots.txt`.

## Mobile demo app (Phase 1)

```bash
cp apps/mobile/.env.example apps/mobile/.env   # EXPO_PUBLIC_DEMO_MODE=true is the default
pnpm --filter @shiftshield/mobile start         # scan the QR code with Expo Go (iOS/Android)
```

On the Welcome screen tap **Demo as Officer** or **Demo as Employer**. Everything is seeded Dallas-Fort
Worth data held in a local store: accepting a shift, reviewing applicants, posting a shift, clock in/out,
messages and the live officer map all update in-app. Payments, background checks and push are mocked.

- Maps use `react-native-maps` with the Google provider. Inside Expo Go on iOS the Google SDK is not
  available, so the map falls back to Apple Maps there; Android Expo Go and all EAS builds use Google.
  Set `GOOGLE_MAPS_IOS_API_KEY` / `GOOGLE_MAPS_ANDROID_API_KEY` before an EAS build.
- Preview build for a phone without Expo Go: `cd apps/mobile && npx eas-cli@latest init && npx eas-cli@latest build --profile preview --platform android` (or `ios`, needs an Apple developer account).
- Checks: `pnpm --filter @shiftshield/mobile typecheck`, `... lint`, `... export:check` (bundles both platforms with Metro), `... doctor`.

## Scripts

```bash
pnpm dev            # all apps via turbo
pnpm dev:web        # web only
pnpm build          # build everything
pnpm lint           # eslint
pnpm typecheck      # tsc --noEmit in every package
pnpm test           # vitest (shared) + playwright (web; needs a prior `pnpm --filter @shiftshield/web build`)
pnpm --filter @shiftshield/mobile start   # Expo dev server
pnpm format         # prettier
```

Run Playwright once with browsers installed: `pnpm --filter @shiftshield/web exec playwright install chromium`.

## Deploy to Vercel

Current production deployment: **https://shiftshield-phi.vercel.app** (Vercel project `shiftshield`,
root directory `apps/web`). `shiftshield.vercel.app` is taken by another Vercel account, so a custom
domain is the real fix (see OPEN_QUESTIONS). Supabase, admin and Resend env vars still need to be
added in the Vercel dashboard before leads are stored.

1. Import the repo in Vercel. Set **Root Directory** to `apps/web`; Vercel detects pnpm
   workspaces and Turborepo automatically.
2. Add the environment variables from the table above (Production + Preview).
3. Deploy. Then set `NEXT_PUBLIC_SITE_URL` to the final domain and redeploy so OG tags and the
   sitemap use it.

From the CLI: `vercel link` inside `apps/web`, then `vercel --prod`.

## Brand assets

Drop the real logo files into `apps/web/public/brand/` and `apps/mobile/assets/brand/`
(see the `README.md` in each folder for file names). Placeholders with the same proportions are in
place until then.

## Business rules that must not drift

- Employer sets the hourly rate; the platform fee is charged **on top**. Officer pay is never reduced.
- No card or bank details are ever stored; all money moves through Stripe.
- Location is tracked only during an active shift (clock-in to clock-out).
- Every business number (fee %, tier caps, lead times, geofence, thresholds) lives in the database
  and is editable by admins. Defaults are in `packages/shared/src/constants/plans.ts`.
- Texas licensing: DPS Private Security Program Level II / III / IV. No UK terminology.

## Contact

ShiftShield, 3500 Oaklawn Ave. #460 PMB 5181, Dallas, TX 75219. Phone (254) 276-4393.
