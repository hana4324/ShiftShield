import { z } from "zod";
import type { CreateConnectOnboardingLinkResponse } from "@shared/api.ts";
import { internalUpdate } from "../_shared/db.ts";
import { notFound } from "../_shared/errors.ts";
import { json, readJson, serve } from "../_shared/http.ts";
import { stripeClient } from "../_shared/stripe.ts";
import { requireRole, requireUser, serviceClient } from "../_shared/supabase.ts";
import { RedirectUrl } from "../_shared/validation.ts";

const Body = z.object({ return_url: RedirectUrl, refresh_url: RedirectUrl });

serve(async (req) => {
  const body = await readJson(req, Body);
  const ctx = await requireUser(req);
  requireRole(ctx, "officer");

  const service = serviceClient();
  const [{ data: officer, error: oErr }, { data: profile, error: pErr }] = await Promise.all([
    service.from("officer_profiles").select("stripe_account_id, payouts_enabled").eq("user_id", ctx.user.id).maybeSingle(),
    service.from("profiles").select("full_name, email, phone").eq("id", ctx.user.id).maybeSingle(),
  ]);
  if (oErr) throw oErr;
  if (pErr) throw pErr;
  if (!officer) throw notFound("officer_profile_required", "Complete your officer profile first.");

  const stripe = stripeClient();
  let accountId = officer.stripe_account_id;
  let payoutsEnabled = officer.payouts_enabled;

  if (!accountId) {
    const email = profile?.email ?? ctx.user.email ?? null;
    const account = await stripe.accounts.create(
      {
        type: "express",
        country: "US",
        ...(email ? { email } : {}),
        business_type: "individual",
        capabilities: { transfers: { requested: true } },
        business_profile: {
          product_description: "Licensed security officer shifts booked through ShiftShield",
          mcc: "7393",
        },
        metadata: { user_id: ctx.user.id, platform: "shiftshield" },
      },
      { idempotencyKey: `connect:${ctx.user.id}` },
    );
    accountId = account.id;
    payoutsEnabled = account.payouts_enabled;
    await internalUpdate("officer_profiles", { column: "user_id", value: ctx.user.id }, {
      stripe_account_id: accountId,
      payouts_enabled: payoutsEnabled,
    });
  } else {
    // Keep payouts_enabled in sync in case a webhook was missed.
    const account = await stripe.accounts.retrieve(accountId);
    if (account.payouts_enabled !== payoutsEnabled) {
      payoutsEnabled = account.payouts_enabled;
      await internalUpdate("officer_profiles", { column: "user_id", value: ctx.user.id }, { payouts_enabled: payoutsEnabled });
    }
  }

  const link = await stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    return_url: body.return_url,
    refresh_url: body.refresh_url,
  });

  const response: CreateConnectOnboardingLinkResponse = {
    onboarding_url: link.url,
    account_id: accountId,
    payouts_enabled: payoutsEnabled,
  };
  return json(response);
});
