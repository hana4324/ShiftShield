import { env } from "./env.ts";

export type SmsResult = { ok: true; id: string | null } | { ok: false; skipped: boolean; error: string };

export interface SmsProvider {
  readonly name: string;
  send(to: string, body: string): Promise<SmsResult>;
}

/** Development fallback: logs the message and reports it as skipped (nothing was delivered). */
export class ConsoleSmsProvider implements SmsProvider {
  readonly name = "console";
  send(to: string, body: string): Promise<SmsResult> {
    console.info(`[sms:console] to=${maskPhone(to)} body=${JSON.stringify(body)}`);
    return Promise.resolve({ ok: false, skipped: true, error: "SMS provider not configured (console)" });
  }
}

/** Twilio Programmable Messaging via the REST API. Active only when TWILIO_* env vars are set. */
export class TwilioSmsProvider implements SmsProvider {
  readonly name = "twilio";
  readonly #sid: string;
  readonly #token: string;
  readonly #from: string;

  constructor(sid: string, token: string, from: string) {
    this.#sid = sid;
    this.#token = token;
    this.#from = from;
  }

  async send(to: string, body: string): Promise<SmsResult> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(this.#sid)}/Messages.json`;
    const form = new URLSearchParams({ To: to, From: this.#from, Body: body });
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${this.#sid}:${this.#token}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    });
    const payload = (await res.json().catch(() => ({}))) as { sid?: string; message?: string; code?: number };
    if (!res.ok) {
      return { ok: false, skipped: false, error: `twilio ${res.status}: ${payload.message ?? "request failed"}` };
    }
    return { ok: true, id: payload.sid ?? null };
  }
}

export function getSmsProvider(): SmsProvider {
  const sid = env("TWILIO_ACCOUNT_SID");
  const token = env("TWILIO_AUTH_TOKEN");
  const from = env("TWILIO_FROM");
  if (sid && token && from) return new TwilioSmsProvider(sid, token, from);
  return new ConsoleSmsProvider();
}

/** Normalize US numbers to E.164 where we can; returns null if hopeless. */
export function toE164(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, "");
  if (/^\+\d{8,15}$/.test(digits)) return digits;
  const bare = digits.replace(/\D/g, "");
  if (bare.length === 10) return `+1${bare}`;
  if (bare.length === 11 && bare.startsWith("1")) return `+${bare}`;
  return null;
}

function maskPhone(phone: string): string {
  return phone.length <= 4 ? "****" : `${"*".repeat(phone.length - 4)}${phone.slice(-4)}`;
}
