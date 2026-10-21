import type { Json } from "@shared/db/types.ts";
import type { Db } from "./supabase.ts";

export type NotifyChannel = "push" | "sms" | "email";

export interface NotifyInput {
  kind: string;
  title: string;
  body: string;
  data?: Record<string, Json | undefined>;
  /** Defaults to ["push"]. Each channel gets its own push_queue row. */
  channels?: readonly NotifyChannel[];
}

function cleanData(data: Record<string, Json | undefined> | undefined, kind: string): Record<string, Json> {
  const out: Record<string, Json> = {};
  for (const [k, v] of Object.entries(data ?? {})) {
    if (v !== undefined) out[k] = v;
  }
  out["kind"] = kind;
  return out;
}

/**
 * Mirror of private.notify(): one in-app notification per user plus one outbox row per channel,
 * drained by the send-push function. Uses the service client (push_queue is service-role only).
 */
export async function notifyUsers(db: Db, userIds: readonly string[], input: NotifyInput): Promise<number> {
  const ids = [...new Set(userIds)].filter((id) => id.length > 0);
  if (ids.length === 0) return 0;
  const channels = input.channels && input.channels.length > 0 ? input.channels : (["push"] as const);
  const data = cleanData(input.data, input.kind);
  const { kind: _kind, ...notificationData } = data;

  const notifications = ids.map((user_id) => ({
    user_id,
    kind: input.kind,
    title: input.title,
    body: input.body,
    data: notificationData as Json,
  }));
  const { error: nErr } = await db.from("notifications").insert(notifications);
  if (nErr) throw nErr;

  const queue = ids.flatMap((user_id) =>
    channels.map((channel) => ({
      user_id,
      title: input.title,
      body: input.body,
      data: data as Json,
      channel,
    }))
  );
  const { error: qErr } = await db.from("push_queue").insert(queue);
  if (qErr) throw qErr;
  return ids.length;
}

export async function notifyUser(db: Db, userId: string, input: NotifyInput): Promise<void> {
  await notifyUsers(db, [userId], input);
}

/** Mirror of private.notify_company(): every member of the company. */
export async function notifyCompany(db: Db, companyId: string, input: NotifyInput): Promise<number> {
  const { data, error } = await db.from("company_members").select("user_id").eq("company_id", companyId);
  if (error) throw error;
  return notifyUsers(db, (data ?? []).map((m) => m.user_id), input);
}
