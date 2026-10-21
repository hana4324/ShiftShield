import type { Json } from "@shared/db/types.ts";
import type { Db } from "./supabase.ts";

/** Read one platform_settings value (jsonb). Returns undefined when the key is missing. */
export async function getSetting(db: Db, key: string): Promise<Json | undefined> {
  const { data, error } = await db.from("platform_settings").select("value").eq("key", key).maybeSingle();
  if (error) throw error;
  return data?.value;
}

export async function getSettingInt(db: Db, key: string, fallback: number): Promise<number> {
  const value = await getSetting(db, key);
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  return fallback;
}

/** Missing or unparseable values are treated as `fallback` (false unless stated). */
export async function getSettingBool(db: Db, key: string, fallback = false): Promise<boolean> {
  const value = await getSetting(db, key);
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "true" || v === "1" || v === "on") return true;
    if (v === "false" || v === "0" || v === "off") return false;
  }
  if (typeof value === "number") return value !== 0;
  return fallback;
}
