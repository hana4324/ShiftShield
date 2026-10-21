import { env } from "./env.ts";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export type EmailResult = { ok: true; id: string | null } | { ok: false; skipped: boolean; error: string };

export function isEmailConfigured(): boolean {
  return !!env("RESEND_API_KEY");
}

function fromAddress(): string {
  return env("RESEND_FROM_EMAIL") ?? "ShiftShield <no-reply@shiftshield.example>";
}

/** Send through the Resend REST API. Skipped (not failed) when RESEND_API_KEY is unset. */
export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const key = env("RESEND_API_KEY");
  if (!key) {
    console.info(`[email:skipped] to=${message.to} subject=${JSON.stringify(message.subject)}`);
    return { ok: false, skipped: true, error: "RESEND_API_KEY not set" };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: fromAddress(),
      to: [message.to],
      subject: message.subject,
      text: message.text,
      ...(message.html ? { html: message.html } : {}),
    }),
  });
  const payload = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
  if (!res.ok) {
    return { ok: false, skipped: false, error: `resend ${res.status}: ${payload.message ?? payload.name ?? "request failed"}` };
  }
  return { ok: true, id: payload.id ?? null };
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
