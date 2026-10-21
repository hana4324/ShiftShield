import { z } from "zod";
import type { CashOutInstantResponse } from "@shared/api.ts";
import { formatCents } from "@shared/money.ts";
import { env } from "../_shared/env.ts";
import { conflict, forbidden, notFound } from "../_shared/errors.ts";
import { json, readJson, serve } from "../_shared/http.ts";
import { notifyUser } from "../_shared/notify.ts";
import { getSettingBool } from "../_shared/settings.ts";
import { stripeClient, unixToIso } from "../_shared/stripe.ts";
import { requireRole, requireUser, serviceClient } from "../_shared/supabase.ts";

const Body = z.object({
  amount_cents: z.number().int().positive().max(1_000_000).optional(),
});

/**
 * Instant payout from the officer's connected-account balance to their debit card.
 * Gated by platform_settings.instant_payouts_enabled AND officer_profiles.instant_payouts_enabled.
 */
serve(async (req) => {
  const body = await readJson(req, Body);
  const ctx = await requireUser(req);
  requireRole(ctx, "officer");

  const service = serviceClient();
  const [platformEnabled, { data: officer, error }] = await Promise.all([
    getSettingBool(service, "instant_payouts_enabled", false),
    service
      .from("officer_profiles")
      .select("stripe_account_id, payouts_enabled, instant_payouts_enabled")
      .eq("user_id", ctx.user.id)
      .maybeSingle(),
  ]);
  if (error) throw error;
  if (!officer) throw notFound("officer_profile_required", "Complete your officer profile first.");
  if (!platformEnabled || !officer.instant_payouts_enabled) {
    throw forbidden("Instant pay is not enabled for your account.");
  }
  if (!officer.stripe_account_id || !officer.payouts_enabled) {
    throw conflict("payouts_not_enabled", "Finish payout setup in Profile before cashing out.");
  }

  const stripe = stripeClient();
  const stripeAccount = officer.stripe_account_id;
  const balance = await stripe.balance.retrieve({}, { stripeAccount });
  const instantAvailable = (balance.instant_available ?? balance.available).find((b) => b.currency === "usd")?.amount ?? 0;
  const amount = body.amount_cents ?? instantAvailable;
  if (amount <= 0) throw conflict("nothing_to_cash_out", "No balance is available for instant pay yet.");
  if (amount > instantAvailable) {
    throw conflict("insufficient_balance", `Only ${formatCents(instantAvailable)} is available for instant pay right now.`);
  }

  const payout = await stripe.payouts.create(
    {
      amount,
      currency: "usd",
      method: "instant",
      description: "ShiftShield instant pay",
      metadata: { user_id: ctx.user.id, kind: "instant_payout" },
    },
    { stripeAccount, idempotencyKey: `payout:${ctx.user.id}:${amount}:${Math.floor(Date.now() / 60_000)}` },
  );

  const feeNote = env("INSTANT_PAYOUT_FEE_NOTE");
  await notifyUser(service, ctx.user.id, {
    kind: "payout.instant",
    title: "Instant pay sent",
    body: `${formatCents(amount)} is on its way to your debit card.${feeNote ? ` ${feeNote}` : ""}`,
    data: { payout_id: payout.id },
  });

  const response: CashOutInstantResponse = {
    payout_id: payout.id,
    amount_cents: payout.amount,
    arrival_estimate: unixToIso(payout.arrival_date) ?? new Date().toISOString(),
  };
  return json(response);
});
