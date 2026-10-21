import "server-only";
import { serverEnv } from "./env";

/**
 * Transactional email through Resend's REST API (no SDK dependency).
 * No-op unless RESEND_API_KEY is set. Never throws: a failed notification must not fail a lead.
 */
export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}): Promise<{ sent: boolean; id?: string; error?: string }> {
  if (!serverEnv.resendApiKey) return { sent: false, error: "RESEND_API_KEY not set" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serverEnv.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: serverEnv.resendFromEmail,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        reply_to: input.replyTo,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[email] Resend error", res.status, body);
      return { sent: false, error: `Resend ${res.status}` };
    }
    const json = (await res.json().catch(() => ({}))) as { id?: string };
    return { sent: true, id: json.id };
  } catch (err) {
    console.error("[email] send failed", err);
    return { sent: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
