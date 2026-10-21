import type { ExpoPushMessage } from "@shared/api.ts";
import { env } from "./env.ts";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const BATCH_SIZE = 100;

export interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

export function isExpoPushToken(token: string): boolean {
  return /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/.test(token);
}

/**
 * Send messages through the Expo Push API in batches of 100.
 * Returns one ticket per message, in input order. A failed batch request yields error tickets.
 */
export async function sendExpoPush(messages: readonly ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
  const tickets: ExpoPushTicket[] = [];
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Accept-Encoding": "gzip, deflate",
    "Content-Type": "application/json",
  };
  const accessToken = env("EXPO_ACCESS_TOKEN");
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE);
    try {
      const res = await fetch(EXPO_PUSH_URL, { method: "POST", headers, body: JSON.stringify(batch) });
      const payload = (await res.json().catch(() => ({}))) as { data?: ExpoPushTicket[]; errors?: { message?: string }[] };
      if (!res.ok || !Array.isArray(payload.data)) {
        const message = payload.errors?.[0]?.message ?? `expo push HTTP ${res.status}`;
        for (let j = 0; j < batch.length; j++) tickets.push({ status: "error", message });
        continue;
      }
      for (let j = 0; j < batch.length; j++) {
        tickets.push(payload.data[j] ?? { status: "error", message: "missing ticket" });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "expo push request failed";
      for (let j = 0; j < batch.length; j++) tickets.push({ status: "error", message });
    }
  }
  return tickets;
}
