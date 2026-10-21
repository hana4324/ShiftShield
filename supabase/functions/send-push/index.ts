import type { ExpoPushMessage, SendPushResponse } from "@shared/api.ts";
import type { PushQueueRow } from "@shared/db/types.ts";
import { sendEmail } from "../_shared/email.ts";
import { isExpoPushToken, sendExpoPush } from "../_shared/expo.ts";
import { json, serve } from "../_shared/http.ts";
import { getSmsProvider, toE164 } from "../_shared/sms.ts";
import { type Db, requireServiceRequest, serviceClient } from "../_shared/supabase.ts";

const BATCH_LIMIT = 200;

type RowStatus = "sent" | "failed" | "skipped";
interface RowResult {
  id: number;
  status: RowStatus;
  error: string | null;
}

function dataRecord(data: PushQueueRow["data"]): Record<string, unknown> {
  return typeof data === "object" && data !== null && !Array.isArray(data) ? data : {};
}

async function drainPush(db: Db, rows: readonly PushQueueRow[]): Promise<RowResult[]> {
  if (rows.length === 0) return [];
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const { data: tokens, error } = await db.from("push_tokens").select("id, user_id, token").in("user_id", userIds);
  if (error) throw error;

  const tokensByUser = new Map<string, { id: string; token: string }[]>();
  for (const t of tokens ?? []) {
    if (!isExpoPushToken(t.token)) continue;
    const list = tokensByUser.get(t.user_id) ?? [];
    list.push({ id: t.id, token: t.token });
    tokensByUser.set(t.user_id, list);
  }

  const results = new Map<number, RowResult>();
  const messages: ExpoPushMessage[] = [];
  const targets: { rowId: number; tokenId: string }[] = [];
  for (const row of rows) {
    const userTokens = tokensByUser.get(row.user_id) ?? [];
    if (userTokens.length === 0) {
      results.set(row.id, { id: row.id, status: "skipped", error: "no push tokens" });
      continue;
    }
    for (const t of userTokens) {
      messages.push({
        to: t.token,
        title: row.title,
        body: row.body,
        data: dataRecord(row.data),
        sound: "default",
        priority: "high",
        channelId: "default",
      });
      targets.push({ rowId: row.id, tokenId: t.id });
    }
  }

  const tickets = await sendExpoPush(messages);
  const deadTokenIds = new Set<string>();
  const perRow = new Map<number, { ok: number; errors: string[] }>();
  tickets.forEach((ticket, i) => {
    const target = targets[i];
    if (!target) return;
    const agg = perRow.get(target.rowId) ?? { ok: 0, errors: [] };
    if (ticket.status === "ok") {
      agg.ok += 1;
    } else {
      const code = ticket.details?.error ?? "";
      if (code === "DeviceNotRegistered") deadTokenIds.add(target.tokenId);
      agg.errors.push(code || ticket.message || "unknown expo error");
    }
    perRow.set(target.rowId, agg);
  });
  for (const [rowId, agg] of perRow) {
    results.set(rowId, agg.ok > 0
      ? { id: rowId, status: "sent", error: agg.errors.length ? agg.errors.join("; ").slice(0, 500) : null }
      : { id: rowId, status: "failed", error: agg.errors.join("; ").slice(0, 500) || "no tickets" });
  }

  if (deadTokenIds.size > 0) {
    const { error: dErr } = await db.from("push_tokens").delete().in("id", [...deadTokenIds]);
    if (dErr) console.error("send-push: failed to delete dead tokens", dErr.message);
  }
  return rows.map((r) => results.get(r.id) ?? { id: r.id, status: "failed", error: "unprocessed" });
}

async function drainContact(
  db: Db,
  rows: readonly PushQueueRow[],
  channel: "sms" | "email",
): Promise<RowResult[]> {
  if (rows.length === 0) return [];
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const { data: profiles, error } = await db.from("profiles").select("id, phone, email").in("id", userIds);
  if (error) throw error;
  const byId = new Map((profiles ?? []).map((p) => [p.id, p] as const));
  const sms = getSmsProvider();

  const out: RowResult[] = [];
  for (const row of rows) {
    const profile = byId.get(row.user_id);
    if (channel === "sms") {
      const to = toE164(profile?.phone);
      if (!to) {
        out.push({ id: row.id, status: "skipped", error: "no phone number" });
        continue;
      }
      const res = await sms.send(to, `${row.title}: ${row.body}`);
      out.push(res.ok
        ? { id: row.id, status: "sent", error: null }
        : { id: row.id, status: res.skipped ? "skipped" : "failed", error: res.error });
    } else {
      const to = profile?.email;
      if (!to) {
        out.push({ id: row.id, status: "skipped", error: "no email address" });
        continue;
      }
      const res = await sendEmail({ to, subject: row.title, text: row.body });
      out.push(res.ok
        ? { id: row.id, status: "sent", error: null }
        : { id: row.id, status: res.skipped ? "skipped" : "failed", error: res.error });
    }
  }
  return out;
}

/** Drains push_queue (called by pg_cron every minute with the service-role key). */
serve(async (req) => {
  requireServiceRequest(req);
  const db = serviceClient();

  const { data: rows, error } = await db
    .from("push_queue")
    .select("*")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(BATCH_LIMIT);
  if (error) throw error;
  const queued = rows ?? [];

  const results = [
    ...(await drainPush(db, queued.filter((r) => r.channel === "push"))),
    ...(await drainContact(db, queued.filter((r) => r.channel === "sms"), "sms")),
    ...(await drainContact(db, queued.filter((r) => r.channel === "email"), "email")),
  ];

  const attemptsById = new Map(queued.map((r) => [r.id, r.attempts] as const));
  const now = new Date().toISOString();
  const summary: SendPushResponse = { sent: 0, failed: 0, skipped: 0 };
  for (const r of results) {
    summary[r.status] += 1;
    const { error: uErr } = await db
      .from("push_queue")
      .update({
        status: r.status,
        attempts: (attemptsById.get(r.id) ?? 0) + 1,
        last_error: r.error,
        sent_at: r.status === "sent" ? now : null,
      })
      .eq("id", r.id);
    if (uErr) console.error("send-push: failed to update row", r.id, uErr.message);
  }
  return json(summary);
});
