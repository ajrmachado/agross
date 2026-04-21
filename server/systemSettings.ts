/**
 * System Settings Service
 * Key-value store for admin-configurable settings persisted in the database.
 *
 * Known keys:
 *   email.corporateEmail   — corporate email address for briefing delivery
 *   email.senderName       — sender display name (default: "AgroRSS Briefing")
 *   email.enableBriefing   — "true" | "false" (default: "true")
 */
import { getDb } from "./db";
import { systemSettings } from "../drizzle/schema";
import { eq } from "drizzle-orm";

/** Get a setting value by key. Returns null if not found. */
export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, key))
    .limit(1);
  return rows[0]?.value ?? null;
}

/** Set (upsert) a setting value. */
export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .insert(systemSettings)
    .values({ key, value })
    .onDuplicateKeyUpdate({ set: { value } });
}

/** Get all settings as a plain object. */
export async function getAllSettings(): Promise<Record<string, string>> {
  const db = await getDb();
  if (!db) return {};
  const rows = await db.select().from(systemSettings);
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

/** Delete a setting. */
export async function deleteSetting(key: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(systemSettings).where(eq(systemSettings.key, key));
}

// ─── Email settings helpers ───────────────────────────────────────────────────

export async function getCorporateEmail(): Promise<string | null> {
  return getSetting("email.corporateEmail");
}

export async function getSenderName(): Promise<string> {
  return (await getSetting("email.senderName")) ?? "AgroRSS Briefing";
}

export async function isBriefingEnabled(): Promise<boolean> {
  const val = await getSetting("email.enableBriefing");
  return val !== "false"; // default: enabled
}
