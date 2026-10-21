import type { ApiError } from "@shared/api.ts";

/** An error that maps directly to an HTTP response body of shape `ApiError`. */
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  toBody(): ApiError {
    const error: ApiError["error"] = { code: this.code, message: this.message };
    if (this.details !== undefined) error.details = this.details;
    return { error };
  }
}

export function badRequest(code: string, message: string, details?: unknown): HttpError {
  return new HttpError(400, code, message, details);
}

export function unauthorized(message = "Sign in to continue."): HttpError {
  return new HttpError(401, "unauthorized", message);
}

export function forbidden(message = "You don't have permission to do that."): HttpError {
  return new HttpError(403, "not_authorized", message);
}

export function notFound(code: string, message: string): HttpError {
  return new HttpError(404, code, message);
}

export function conflict(code: string, message: string, details?: unknown): HttpError {
  return new HttpError(409, code, message, details);
}

export function internal(message = "Something went wrong. Please try again."): HttpError {
  return new HttpError(500, "internal_error", message);
}

/** Shape of a supabase-js / PostgREST error. */
export interface PostgrestLikeError {
  message?: string;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
}

export function isPostgrestLike(err: unknown): err is PostgrestLikeError {
  return typeof err === "object" && err !== null && "message" in err && ("code" in err || "details" in err);
}

function slug(text: string): string {
  const s = text.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return s || "db_error";
}

/**
 * Map a PostgREST/SQL error to an HttpError.
 * SQL business rules raise `raise exception '<code>' using errcode = 'P0001', detail = '<human text>'`
 * and are forwarded as 409 `{ code: <code>, message: <detail> }`.
 */
export function fromPostgrest(err: PostgrestLikeError): HttpError {
  const message = (err.message ?? "").trim();
  const details = (err.details ?? "").trim();
  const code = (err.code ?? "").trim();

  if (code === "42501" || /not authorized/i.test(message)) {
    return forbidden(details || "You don't have permission to do that.");
  }
  if (code === "PGRST301" || (/jwt/i.test(message) && /expired|invalid|malformed/i.test(message))) {
    return unauthorized("Your session has expired. Sign in again.");
  }
  if (/not found$/i.test(message) && (code === "P0001" || code === "")) {
    return notFound(slug(message), message);
  }
  if (code === "P0001" || code.startsWith("P0")) {
    return conflict(slug(message), details || message);
  }
  if (code === "23505") {
    return conflict("duplicate", "That record already exists.");
  }
  if (code.startsWith("23")) {
    return conflict(slug(code), details || "The request conflicts with existing data.");
  }
  console.error("Unmapped database error", { code, message, details, hint: err.hint ?? null });
  return internal();
}

/** Narrow any thrown value to an HttpError (PostgREST errors get mapped; everything else is a 500). */
export function toHttpError(err: unknown): HttpError {
  if (err instanceof HttpError) return err;
  if (isPostgrestLike(err)) return fromPostgrest(err);
  return internal();
}
