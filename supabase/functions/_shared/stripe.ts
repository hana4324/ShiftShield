import Stripe from "stripe";
import { requireEnv } from "./env.ts";
import { HttpError, conflict } from "./errors.ts";

/**
 * Pinned so Stripe object shapes never change under us without a code change.
 * Must match the stripe-node version in deno.json (18.5.0 -> 2025-08-27.basil).
 */
export const STRIPE_API_VERSION = "2025-08-27.basil" as const;

let cached: Stripe | null = null;

export function stripeClient(): Stripe {
  if (cached) return cached;
  cached = new Stripe(requireEnv("STRIPE_SECRET_KEY"), {
    apiVersion: STRIPE_API_VERSION,
    httpClient: Stripe.createFetchHttpClient(),
    appInfo: { name: "ShiftShield", url: "https://shiftshield.example" },
    maxNetworkRetries: 2,
  });
  return cached;
}

export { Stripe };

export function isStripeError(err: unknown): err is Stripe.errors.StripeError {
  return err instanceof Stripe.errors.StripeError;
}

/** Extract an id from a Stripe expandable field. */
export function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

/** Card declines and bad requests become 409/400 ApiErrors; everything else is a 500. */
export function stripeToHttpError(err: Stripe.errors.StripeError): HttpError {
  switch (err.type) {
    case "StripeCardError":
      return conflict("card_declined", err.message);
    case "StripeInvalidRequestError":
      return new HttpError(400, "stripe_invalid_request", err.message);
    case "StripeRateLimitError":
      return new HttpError(429, "stripe_rate_limited", "Too many requests. Try again in a moment.");
    default:
      console.error("Stripe error", err.type, err.code, err.message);
      return new HttpError(502, "stripe_unavailable", "Payment provider is unavailable. Try again.");
  }
}

export function unixToIso(seconds: number | null | undefined): string | null {
  return typeof seconds === "number" ? new Date(seconds * 1000).toISOString() : null;
}
