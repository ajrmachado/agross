/**
 * whatsappTokenService.ts
 *
 * Manages personalized access tokens sent in WhatsApp Morning Call links.
 * Each token is unique per user per day, expires in 12 hours, and is
 * single-use to prevent link sharing.
 *
 * Flow:
 *   sendMorningCallWhatsApp() → generateAccessToken(userId) → link in message
 *   User clicks link → /acesso?token=xxx → validateToken(token) → grant/deny access
 */
import { getDb } from "./db";
import { whatsappAccessTokens, users } from "../drizzle/schema";
import { eq, lt, and } from "drizzle-orm";
import crypto from "crypto";

const TOKEN_EXPIRY_HOURS = 12;

/** Generate a cryptographically secure random token */
function generateSecureToken(): string {
  return crypto.randomBytes(32).toString("hex"); // 64 hex chars
}

/**
 * Create a new access token for a user.
 * Expires in 12 hours from now.
 */
export async function generateAccessToken(userId: number): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;

  const token = generateSecureToken();
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  try {
    await db.insert(whatsappAccessTokens).values({
      token,
      userId,
      expiresAt,
    });
    return token;
  } catch (err) {
    console.error("[WhatsApp Token] Failed to create token:", err);
    return null;
  }
}

/**
 * Validate a token and return the associated user if valid.
 * Marks the token as used on first access.
 * Returns null if token is invalid, expired, or already used.
 */
export async function validateAccessToken(token: string): Promise<{
  valid: boolean;
  userId?: number;
  reason?: "not_found" | "expired" | "already_used";
}> {
  const db = await getDb();
  if (!db) return { valid: false, reason: "not_found" };

  const rows = await db
    .select()
    .from(whatsappAccessTokens)
    .where(eq(whatsappAccessTokens.token, token))
    .limit(1);

  if (rows.length === 0) {
    return { valid: false, reason: "not_found" };
  }

  const record = rows[0];

  // Check expiry
  if (new Date() > record.expiresAt) {
    return { valid: false, reason: "expired" };
  }

  // Check if already used (single-use)
  if (record.usedAt) {
    return { valid: false, reason: "already_used" };
  }

  // Mark as used
  await db
    .update(whatsappAccessTokens)
    .set({ usedAt: new Date() })
    .where(eq(whatsappAccessTokens.token, token));

  return { valid: true, userId: record.userId };
}

/**
 * Get user info for a valid token (without consuming it).
 * Used to check if a token is still valid for display purposes.
 */
export async function peekAccessToken(token: string): Promise<{
  valid: boolean;
  userId?: number;
  expiresAt?: Date;
  reason?: "not_found" | "expired" | "already_used";
}> {
  const db = await getDb();
  if (!db) return { valid: false, reason: "not_found" };

  const rows = await db
    .select()
    .from(whatsappAccessTokens)
    .where(eq(whatsappAccessTokens.token, token))
    .limit(1);

  if (rows.length === 0) {
    return { valid: false, reason: "not_found" };
  }

  const record = rows[0];

  if (new Date() > record.expiresAt) {
    return { valid: false, reason: "expired", expiresAt: record.expiresAt };
  }

  if (record.usedAt) {
    return { valid: false, reason: "already_used" };
  }

  return { valid: true, userId: record.userId, expiresAt: record.expiresAt };
}

/**
 * Clean up expired tokens (run periodically).
 */
export async function cleanExpiredTokens(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db
    .delete(whatsappAccessTokens)
    .where(lt(whatsappAccessTokens.expiresAt, new Date()));
}
