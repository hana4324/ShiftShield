/**
 * Background check provider abstraction.
 *
 * ManualProvider: marks the officer 'pending'; an admin flips the result from the admin panel
 * (RPC admin_set_background_status). This is the launch configuration.
 * CheckrProvider: stub for a Checkr integration; throws until CHECKR_API_KEY is set and the
 * TODOs are implemented.
 *
 * Select with env BACKGROUND_CHECK_PROVIDER = manual | checkr (default manual).
 */
import type { BackgroundStatus } from "@shared/db/types.ts";
import { env } from "./env.ts";
import { notFound } from "./errors.ts";
import type { Db } from "./supabase.ts";

export interface OfficerForCheck {
  user_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
}

export interface StartResult {
  reference: string | null;
  status: BackgroundStatus;
}

export interface BackgroundCheckProvider {
  readonly name: string;
  start(officer: OfficerForCheck): Promise<StartResult>;
  status(reference: string): Promise<BackgroundStatus>;
}

export class ManualProvider implements BackgroundCheckProvider {
  readonly name = "manual";

  start(officer: OfficerForCheck): Promise<StartResult> {
    // Reference is a human-readable ticket id so admins can match it in their queue.
    return Promise.resolve({ reference: `manual:${officer.user_id}:${Date.now()}`, status: "pending" });
  }

  /** Manual checks never resolve on their own; the stored DB status is the truth. */
  status(_reference: string): Promise<BackgroundStatus> {
    return Promise.resolve("pending");
  }
}

export class CheckrProvider implements BackgroundCheckProvider {
  readonly name = "checkr";
  readonly #apiKey: string | undefined;

  constructor(apiKey: string | undefined) {
    this.#apiKey = apiKey;
  }

  #ensureConfigured(): string {
    if (!this.#apiKey) throw new Error("CheckrProvider is not configured: set CHECKR_API_KEY");
    return this.#apiKey;
  }

  start(_officer: OfficerForCheck): Promise<StartResult> {
    this.#ensureConfigured();
    // TODO(checkr): POST https://api.checkr.com/v1/candidates  { first_name, last_name, email, phone, ... }
    // TODO(checkr): POST https://api.checkr.com/v1/invitations { candidate_id, package: "<your package slug>" }
    //               Return { reference: invitation.id (or report id), status: "pending" } and register the
    //               report.completed webhook so stripe-webhook's sibling can flip the status.
    throw new Error("CheckrProvider.start is not implemented yet");
  }

  status(_reference: string): Promise<BackgroundStatus> {
    this.#ensureConfigured();
    // TODO(checkr): GET https://api.checkr.com/v1/reports/{id} and map result/adjudication:
    //               clear -> "clear", consider -> "consider", suspended/canceled -> "failed", else "pending".
    throw new Error("CheckrProvider.status is not implemented yet");
  }
}

export function getBackgroundCheckProvider(): BackgroundCheckProvider {
  const selected = (env("BACKGROUND_CHECK_PROVIDER") ?? "manual").toLowerCase();
  switch (selected) {
    case "manual":
      return new ManualProvider();
    case "checkr":
      return new CheckrProvider(env("CHECKR_API_KEY"));
    default:
      throw new Error(`Unknown BACKGROUND_CHECK_PROVIDER "${selected}" (expected manual | checkr)`);
  }
}

export interface BackgroundCheckState {
  provider: string;
  status: BackgroundStatus;
  reference: string | null;
}

/** Persist a status through the service-role-aware RPC (sets provider/reference + audit + activation). */
export async function setBackgroundStatus(
  service: Db,
  officerId: string,
  status: BackgroundStatus,
  provider: string,
  reference: string | null,
): Promise<BackgroundCheckState> {
  const { data, error } = await service.rpc("admin_set_background_status", {
    p_officer_id: officerId,
    p_status: status,
    p_provider: provider,
    p_reference: reference,
  });
  if (error) throw error;
  return {
    provider: data.background_provider ?? provider,
    status: data.background_status,
    reference: data.background_reference,
  };
}

/** Start (or restart) a background check for an officer with the configured provider. */
export async function startBackgroundCheck(service: Db, officerId: string): Promise<BackgroundCheckState> {
  const { data: profile, error } = await service
    .from("profiles")
    .select("id, full_name, email, phone")
    .eq("id", officerId)
    .maybeSingle();
  if (error) throw error;
  if (!profile) throw notFound("officer_not_found", "Officer profile not found.");

  const provider = getBackgroundCheckProvider();
  const result = await provider.start({
    user_id: profile.id,
    full_name: profile.full_name,
    email: profile.email,
    phone: profile.phone,
  });
  return setBackgroundStatus(service, officerId, result.status, provider.name, result.reference);
}

/** Poll the provider for a pending check and persist any change. */
export async function refreshBackgroundCheck(service: Db, officerId: string): Promise<BackgroundCheckState> {
  const { data: op, error } = await service
    .from("officer_profiles")
    .select("background_status, background_provider, background_reference")
    .eq("user_id", officerId)
    .maybeSingle();
  if (error) throw error;
  if (!op) throw notFound("officer_not_found", "Officer profile not found.");

  const current: BackgroundCheckState = {
    provider: op.background_provider ?? "manual",
    status: op.background_status,
    reference: op.background_reference,
  };
  if (current.status !== "pending" || !current.reference) return current;

  const provider = getBackgroundCheckProvider();
  if (provider.name !== current.provider) return current;
  const next = await provider.status(current.reference);
  if (next === current.status) return current;
  return setBackgroundStatus(service, officerId, next, provider.name, current.reference);
}
