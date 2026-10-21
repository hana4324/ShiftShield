# Open questions

Decisions the client (Ashley Jackson) is still making. Each item lists the **default** currently
built so work can continue; every default is configurable (DB `plans` / `platform_settings`
tables, editable from the admin panel once it exists).

## Business rules

1. **Platform fee.** Client has said 2%; other notes say 10-15%.
   **Default:** 10% (1000 bps) on Essential and Pro, 8% (800 bps) on Enterprise, charged to the
   employer **on top of** the posted hourly rate. The officer always receives the full posted rate.
   Confirm the number and confirm "on top." (`packages/shared/src/constants/plans.ts` -> `feeBps`)

2. **Daily / instant pay.** Enterprise-only, all tiers, or off at launch?
   **Default:** Enterprise only, behind a feature flag (`plans.daily_pay_enabled`). Also depends on
   the officer's Stripe Connect account supporting Instant Payouts.

3. **Pro cap.** 30 or 40 bookings a month? Do caps count officers, shifts, or officer-shifts?
   **Default:** 40, counted as confirmed officer-shift assignments in the current billing period.
   Posted-shift cap is a separate counter (also 40 on Pro, 15 on Essential).

4. **Lead-time limits.** Exact minimum lead time for Essential and Pro.
   **Default:** Essential 24 h, Pro 4 h, Enterprise none ("Fill Now").

5. **Deactivation thresholds.** Minimum rating, number of no-shows, time window.
   **Default:** rating below 4.0 after 10+ rated shifts, or 2 no-shows in 90 days, or 3 late
   cancellations (under 12 h) in 90 days. Warning sent when one strike away.

6. **Background check provider.** Checkr is the likely default. Does the $30 signup fee cover the
   full cost? **Default:** manual/admin provider behind a `BackgroundCheckProvider` interface;
   signup fee $30 (`platform_settings.signup_fee_cents`).

7. **Pilot terms.** Is the 30-day pilot free, and does it require a card up front?
   **Default:** free for 30 days via Stripe `trial_period_days = 30`; a card is collected at
   checkout so billing starts automatically unless cancelled. Admin can mark a company `is_pilot`.

8. **Liability insurance.** Who carries liability insurance for officers on shift? Needed for the
   Insurance Disclaimer page and the Employer Subscription Agreement.

9. **Domain name** for the landing page. **Default:** https://shiftshield-phi.vercel.app until decided
   (`shiftshield.vercel.app` is owned by another Vercel account). Set `NEXT_PUBLIC_SITE_URL` in
   Vercel once the custom domain is live.

## Phase 0 decisions made with defaults (confirm or change)

10. **Admin access before Supabase Auth exists.** `/admin` is protected by a single shared
    password (`ADMIN_PASSWORD`) with a signed HTTP-only cookie. Phase 2 replaces this with
    Supabase Auth + the `admin` role; the code paths are isolated in `apps/web/src/lib/admin-auth.ts`.

11. **Lead notification email.** Sent via Resend only when `RESEND_API_KEY` and
    `LEAD_NOTIFY_EMAIL` are set. Which address should receive them?

12. **Rate limiting.** In-memory per-instance limiter (5 submissions / 10 min per IP hash) plus a
    honeypot and a 3-second minimum fill time. Upgrade to Upstash/Vercel KV if spam appears.

13. **Founder block.** Copy says "Licensed armed security officer (Texas Level III)", "Former
    security director", "U.S. Army veteran". Confirm wording and supply a photo
    (`apps/web/public/brand/founder.jpg`).

14. **Texas DPS lookup URL** used in admin license review is set to the TOPS self-service search.
    Confirm the preferred lookup page.

## Phase 1 (demo app) decisions made with defaults

15. **Maps inside Expo Go on iOS** fall back to Apple Maps because Expo Go does not bundle the
    Google Maps SDK. Android Expo Go and every EAS/dev build use the Google provider as specified.
    Google Maps keys are needed before the first EAS build (`GOOGLE_MAPS_IOS_API_KEY`,
    `GOOGLE_MAPS_ANDROID_API_KEY`).

16. **Site hero photos** are placeholders (site-type icon on navy). Drop real photos into
    `apps/mobile/assets/sites/` and the Shift Details screen can switch to an `<Image>`.

17. **Demo company** is a single Pro-plan security contractor ("Lone Star Protective Services")
    that owns all five DFW sites, so one dataset serves both the officer and employer demos.

18. **Clock-in geofence in the demo** is simulated as "inside the fence"; real GPS checks and the
    "I'm here, request override" flow land in Phase 3.

19. **App identifiers** default to `com.shiftshield.app` (iOS bundle id and Android package).
    Confirm before the first store build; changing later means new store listings.
