import "jsr:@supabase/functions-js@2/edge-runtime.d.ts";
import { ZodError, type ZodType } from "zod";
import { HttpError, badRequest, toHttpError } from "./errors.ts";

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, stripe-signature, x-supabase-client-platform",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

export function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS_HEADERS, ...extraHeaders },
  });
}

export function error(err: HttpError): Response {
  return json(err.toBody(), err.status);
}

/** Returns a preflight response for OPTIONS requests, otherwise null. */
export function handleOptions(req: Request): Response | null {
  if (req.method !== "OPTIONS") return null;
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/** Parse the JSON body (empty body = {}) and validate it. Throws a 400 HttpError on failure. */
export async function readJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown = {};
  const text = await req.text();
  if (text.trim().length > 0) {
    try {
      raw = JSON.parse(text);
    } catch {
      throw badRequest("invalid_json", "Request body must be valid JSON.");
    }
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw badRequest("invalid_request", "Request body failed validation.", parsed.error.flatten());
  }
  return parsed.data;
}

export interface ServeOptions {
  /** Allowed methods besides OPTIONS. Defaults to POST only. */
  methods?: readonly string[];
}

/**
 * Standard wrapper for every function: CORS preflight, method check, and a try/catch that
 * turns HttpError / Zod / PostgREST errors into ApiError bodies and everything else into a
 * generic 500 (details go to the logs, never to the client).
 */
export function serve(handler: (req: Request) => Promise<Response>, options: ServeOptions = {}): void {
  const methods = options.methods ?? ["POST"];
  Deno.serve(async (req: Request): Promise<Response> => {
    const preflight = handleOptions(req);
    if (preflight) return preflight;
    if (!methods.includes(req.method)) {
      return json(
        { error: { code: "method_not_allowed", message: `Use ${methods.join(" or ")}.` } },
        405,
        { Allow: [...methods, "OPTIONS"].join(", ") },
      );
    }
    try {
      return await handler(req);
    } catch (err) {
      if (err instanceof ZodError) {
        return error(badRequest("invalid_request", "Request body failed validation.", err.flatten()));
      }
      const mapped = toHttpError(err);
      if (mapped.status >= 500) {
        console.error(`[${new URL(req.url).pathname}] unhandled error`, err);
      }
      return error(mapped);
    }
  });
}
