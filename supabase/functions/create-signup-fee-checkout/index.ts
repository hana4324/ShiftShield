import { z } from "zod";
import type { CreateSignupFeeCheckoutResponse } from "@shared/api.ts";
import { PLATFORM_SETTING_DEFAULTS } from "@shared/constants/plans.ts";
import { conflict, internal } from "../_shared/errors.ts";
import { json, readJson, serve } from "../_shared/http.ts";
import { getSettingInt } from "../_shared/settings.ts";
import { stripeClient } from "../_shared/stripe.ts";
import { requireRole, requireUser, serviceClient } from "../_shared/supabase.ts";
import { RedirectUrl } from "../_shared/validation.ts";

const Body = z.object({ success_url: RedirectUrl, cancel_url: RedirectUrl });

serve(async (req) => {
  const body = await readJson(req, Body);
  const ctx = await requireUser(req);
  requireRole(ctx, "officer");

  const service = serviceClient();
  const { data: officer, error } = await service
    .from("officer_profiles")
    .select("signup_fee_paid_at")
    .eq("user_id", ctx.user.id)
    .maybeSingle();
  if (error) throw error;
  if (officer?.signup_fee_paid_at) throw conflict("already_paid", "Your signup fee has already been paid.");

  const amountCents = await getSettingInt(service, "signup_fee_cents", PLATFORM_SETTING_DEFAULTS.signup_fee_cents);
  const stripe = stripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    client_reference_id: ctx.user.id,
    ...(ctx.user.email ? { customer_email: ctx.user.email } : {}),
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: amountCents,
          product_data: {
            name: "ShiftShield officer signup fee",
            description: "One-time fee that covers your background check.",
          },
        },
      },
    ],
    success_url: body.success_url,
    cancel_url: body.cancel_url,
    metadata: { kind: "signup_fee", user_id: ctx.user.id },
    payment_intent_data: { metadata: { kind: "signup_fee", user_id: ctx.user.id } },
  });
  if (!session.url) throw internal("Stripe did not return a checkout URL.");

  const response: CreateSignupFeeCheckoutResponse = {
    checkout_url: session.url,
    session_id: session.id,
    amount_cents: amountCents,
  };
  return json(response);
});
