# Hosted demo: ShiftShield inside a shared Supabase project

The hosted demo (https://shiftshield-phi.vercel.app) does not have its own Supabase project. It runs
inside the existing project "hana4324's Project" (`emmebhepuyhgmllfrssf`), which another app already
uses. To keep the two apps apart, ShiftShield's objects live in schema **`shiftshield`** instead of
`public` (helpers stay in `private`, which that project did not have).

What was applied there (2026-10-27), derived from `supabase/migrations` + `supabase/seed.sql`:

- Every `public.` reference rewritten to `shiftshield.`, `search_path = public` to `= shiftshield`.
- Skipped: `pg_cron` / `pg_net` and the cron jobs, the storage buckets/policies (the other app owns
  an `avatars` bucket), the `auth.users` triggers, the realtime publication change, and the
  `profiles.id -> auth.users` foreign key (demo users are profile rows only; nobody signs in).
- `private.is_admin()` also returns true for `service_role` (same as migration
  `20261027000000_service_role_is_admin.sql`), which is how `ADMIN_OPEN_ACCESS` mode works.

Web app settings for that project:

```
NEXT_PUBLIC_SUPABASE_URL=https://emmebhepuyhgmllfrssf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
NEXT_PUBLIC_SUPABASE_SCHEMA=shiftshield
SUPABASE_SERVICE_ROLE_KEY=<service role key>   # required for ADMIN_OPEN_ACCESS reads
ADMIN_OPEN_ACCESS=1
```

One-time dashboard steps (cannot be done from SQL):

1. Project Settings > API > **Exposed schemas**: add `shiftshield`. Without it PostgREST answers
   `PGRST106 Invalid schema`.
2. Copy the **service_role** key into Vercel as `SUPABASE_SERVICE_ROLE_KEY` (Production).

For a dedicated project, use the repo migrations unchanged and leave `NEXT_PUBLIC_SUPABASE_SCHEMA`
unset.
