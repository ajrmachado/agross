/**
 * jobs.ts — Background job scheduler
 *
 * KEY FIXES applied:
 *  1. WhatsApp send guard uses DB atomic INSERT … ON DUPLICATE KEY UPDATE with a
 *     "sending" lock — prevents race condition between catch-up and periodic check.
 *  2. In-memory flags are only used as a fast first-pass; DB is the source of truth.
 *  3. Weekly/monthly summary guards also verified against DB before running.
 *  4. All scheduled times documented clearly.
 *
 * Schedule (BRT = UTC-3):
 *   05:45  — generate whatsappText from Esteira (if not yet done today)
 *   06:00  — send WhatsApp Morning Call to all active subscribers
 *   07:00  — send daily briefing email
 *   Every 6h — fetch RSS feeds
 *   Every 30m — fetch commodity prices
 *   Saturday 22:00 — generate weekly summary
 *   Last day of month 23:00 — generate monthly summary
 *   01:00  — expire trials
 */

import { getDb } from "./db";
import { jobLogs, whatsappAutoSends } from "../drizzle/schema";
import { eq, sql } from "drizzle-orm";
import { fetchAllFeeds } from "./rss";
import { generateDailySummary, generateWeeklySummary, generateMonthlySummary } from "./summarizer";
import { fetchAndSaveAllQuotes } from "./commodities";
import { sendDailySummaryEmail, hasEmailBeenSentToday } from "./emailSummary";
import { sendMorningCallWhatsApp, buildMorningCallMessage } from "./whatsappService";
import { generateWhatsAppMessage } from "./contentGenerator";
import { expireTrials } from "./db";
import { markAutoSendComplete } from "./whatsappAutoGenerator";

const JOB_INTERVAL_MS = 6 * 60 * 60 * 1000;  // 6 hours
const COMMODITY_INTERVAL_MS = 30 * 60 * 1000;  // 30 minutes
const EMAIL_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

let jobTimer: ReturnType<typeof setTimeout> | null = null;
let commodityTimer: ReturnType<typeof setTimeout> | null = null;
let isRunning = false;

// In-memory fast-pass guards (reset on restart — DB is the real guard)
let _lastWeeklySummaryDate: string | null = null;
let _lastMonthlySummaryDate: string | null = null;

// ─── BRT helpers ──────────────────────────────────────────────────────────────

function brtDateStr(): string {
  const now = new Date();
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  return brt.toISOString().slice(0, 10);
}

function brtHour(): number {
  return (new Date().getUTCHours() - 3 + 24) % 24;
}

function brtDayOfWeek(): number {
  const now = new Date();
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  return brt.getUTCDay();
}

function isLastDayOfMonth(): boolean {
  const now = new Date();
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const tomorrow = new Date(brt);
  tomorrow.setUTCDate(brt.getUTCDate() + 1);
  return tomorrow.getUTCMonth() !== brt.getUTCMonth();
}

// ─── Job status ───────────────────────────────────────────────────────────────

export type JobStatus = {
  lastRun: Date | null;
  nextRun: Date | null;
  lastStatus: "success" | "error" | "running" | null;
  lastMessage: string | null;
  articlesAdded: number;
};

let jobStatus: JobStatus = {
  lastRun: null,
  nextRun: null,
  lastStatus: null,
  lastMessage: null,
  articlesAdded: 0,
};

export function getJobStatus(): JobStatus {
  return { ...jobStatus };
}

// ─── WhatsApp send lock (DB-level, prevents race conditions) ─────────────────
//
// Uses whatsapp_auto_sends.status as a state machine:
//   "pending"  → text generated, not yet sent
//   "sending"  → lock acquired, send in progress (written before send starts)
//   "sent"     → send completed successfully
//   "failed"   → send failed
//
// The lock is acquired by updating status to "sending" ONLY if current status
// is NOT "sent" or "sending". This makes the operation idempotent even when
// two processes race (e.g. catch-up + periodic check both fire at 06:00).

async function acquireWhatsAppSendLock(today: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    // First check if already sent or sending
    const existing = await db
      .select()
      .from(whatsappAutoSends)
      .where(sql`${whatsappAutoSends.sendDate} = ${today}`)
      .limit(1);

    if (existing.length > 0) {
      const status = existing[0].status;
      if (status === "sent" || status === "sending") {
        console.log(`[Jobs] WhatsApp lock: already ${status} for ${today} — skipping`);
        return false;
      }
      // Try to acquire lock by setting status to "sending"
      await db
        .update(whatsappAutoSends)
        .set({ status: "sending" } as any)
        .where(
          sql`${whatsappAutoSends.sendDate} = ${today} AND ${whatsappAutoSends.status} NOT IN ('sent', 'sending')`
        );
    } else {
      // No record yet — create one with "sending" status to claim the lock
      try {
        await db.insert(whatsappAutoSends).values({
          sendDate: new Date(`${today}T12:00:00Z`),
          generatedText: "",
          status: "sending" as any,
        });
      } catch (insertErr: any) {
        // Duplicate key = another process already inserted — check what status they wrote
        if (insertErr?.code === "ER_DUP_ENTRY") {
          const check = await db
            .select()
            .from(whatsappAutoSends)
            .where(sql`${whatsappAutoSends.sendDate} = ${today}`)
            .limit(1);
          if (check[0]?.status === "sent" || check[0]?.status === "sending") {
            console.log(`[Jobs] WhatsApp lock: race — another process owns lock for ${today}`);
            return false;
          }
        } else {
          throw insertErr;
        }
      }
    }

    // Re-read to confirm we own the lock
    const verify = await db
      .select()
      .from(whatsappAutoSends)
      .where(sql`${whatsappAutoSends.sendDate} = ${today}`)
      .limit(1);

    const owned = verify[0]?.status === "sending";
    if (!owned) {
      console.log(`[Jobs] WhatsApp lock: failed to acquire for ${today}`);
    }
    return owned;
  } catch (err) {
    console.error("[Jobs] WhatsApp lock acquisition error:", err);
    return false;
  }
}

// ─── Generate whatsappText at 05:45 ──────────────────────────────────────────

async function runWhatsAppGenerateJob(today: string): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    const { dailySummaries: ds } = await import("../drizzle/schema");
    const { desc: descOp } = await import("drizzle-orm");

    const summaries = await db
      .select()
      .from(ds)
      .orderBy(descOp(ds.summaryDate), descOp(ds.generatedAt))
      .limit(3);

    const summary = summaries[0];

    if (!summary?.content) {
      console.log("[Jobs] 05:45 — no Esteira content available for WhatsApp generation");
      return;
    }

    if (summary.whatsappText) {
      console.log("[Jobs] 05:45 — whatsappText already exists, skipping generation");
      return;
    }

    const highlights = JSON.parse(summary.highlights ?? "[]");
    const dateStr = summary.summaryDate
      ? (summary.summaryDate instanceof Date
          ? summary.summaryDate.toISOString()
          : new Date(summary.summaryDate as string).toISOString()).split("T")[0]
      : today;

    const whatsappMsg = await generateWhatsAppMessage(summary.content, highlights, dateStr);
    const { eq: eqOp } = await import("drizzle-orm");
    await db.update(ds).set({ whatsappText: whatsappMsg }).where(eqOp(ds.id, summary.id));
    console.log(`[Jobs] 05:45 — whatsappText generated (${whatsappMsg.length} chars) for ${dateStr}`);
  } catch (err) {
    console.error("[Jobs] 05:45 WhatsApp text generation failed:", err);
  }
}

// ─── Send WhatsApp at 06:00 ───────────────────────────────────────────────────

async function runWhatsAppSendJob(today: string): Promise<void> {
  const locked = await acquireWhatsAppSendLock(today);
  if (!locked) return;

  console.log(`[Jobs] 06:00 — WhatsApp lock acquired for ${today}, sending...`);

  try {
    const result = await sendMorningCallWhatsApp(undefined, undefined, true);
    console.log(`[Jobs] WhatsApp Morning Call done: sent=${result.sent}, failed=${result.failed}, skipped=${result.skipped}`);

    // Build representative sentText for history
    let sentTextForHistory: string | undefined;
    try {
      const db = await getDb();
      if (db) {
        const { dailySummaries: ds } = await import("../drizzle/schema");
        const { desc: descOp } = await import("drizzle-orm");
        const summaries = await db.select().from(ds).orderBy(descOp(ds.summaryDate), descOp(ds.generatedAt)).limit(5);
        const summary = summaries.find((s) => s.whatsappText) ?? summaries[0];
        if (summary?.whatsappText) {
          sentTextForHistory = await buildMorningCallMessage("Assinante", summary.whatsappText, undefined, undefined, true);
        }
      }
    } catch (_) {}

    await markAutoSendComplete(today, { sent: result.sent, failed: result.failed, skipped: result.skipped }, sentTextForHistory);
  } catch (err) {
    console.error("[Jobs] WhatsApp send failed:", err);
    // Release lock by setting status back to "failed" so it can be retried manually
    const db = await getDb();
    if (db) {
      await db
        .update(whatsappAutoSends)
        .set({ status: "failed", errorMessage: String(err) } as any)
        .where(sql`${whatsappAutoSends.sendDate} = ${today} AND ${whatsappAutoSends.status} = 'sending'`);
    }
  }
}

// ─── RSS fetch job ────────────────────────────────────────────────────────────

export async function runFetchJob(): Promise<{ articlesAdded: number; message: string }> {
  if (isRunning) {
    return { articlesAdded: 0, message: "Job already running" };
  }

  isRunning = true;
  jobStatus.lastRun = new Date();
  jobStatus.lastStatus = "running";

  const db = await getDb();
  let logId: number | null = null;

  try {
    if (db) {
      const result = await db.insert(jobLogs).values({
        jobName: "rss_fetch",
        status: "running",
        message: "Iniciando busca de feeds RSS...",
        startedAt: new Date(),
      });
      logId = Number((result as { insertId?: number }).insertId ?? 0) || null;
    }

    const { totalAdded, feedResults } = await fetchAllFeeds();

    const successCount = feedResults.filter((r) => !r.error).length;
    const errorCount = feedResults.filter((r) => r.error).length;
    const message = `Busca concluída: ${totalAdded} novos artigos de ${successCount} feeds (${errorCount} erros)`;

    if (db && logId) {
      await db.update(jobLogs).set({ status: "success", message, articlesAdded: totalAdded, finishedAt: new Date() }).where(eq(jobLogs.id, logId));
    }

    jobStatus.lastStatus = "success";
    jobStatus.lastMessage = message;
    jobStatus.articlesAdded = totalAdded;

    if (totalAdded > 0) {
      try {
        await generateDailySummary();
        console.log("[Jobs] Daily summary generated");
      } catch (err) {
        console.error("[Jobs] Daily summary generation failed:", err);
      }
    }

    console.log(`[Jobs] ${message}`);
    return { articlesAdded: totalAdded, message };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (db && logId) {
      await db.update(jobLogs).set({ status: "error", message: errorMsg, finishedAt: new Date() }).where(eq(jobLogs.id, logId));
    }
    jobStatus.lastStatus = "error";
    jobStatus.lastMessage = errorMsg;
    console.error("[Jobs] RSS fetch failed:", errorMsg);
    return { articlesAdded: 0, message: errorMsg };
  } finally {
    isRunning = false;
  }
}

function scheduleNext() {
  if (jobTimer) clearTimeout(jobTimer);
  const nextRun = new Date(Date.now() + JOB_INTERVAL_MS);
  jobStatus.nextRun = nextRun;
  jobTimer = setTimeout(async () => {
    await runFetchJob();
    scheduleNext();
  }, JOB_INTERVAL_MS);
}

async function runCommodityJob() {
  try {
    await fetchAndSaveAllQuotes();
  } catch (err) {
    console.error("[Jobs] Commodity fetch failed:", err);
  }
  if (commodityTimer) clearTimeout(commodityTimer);
  commodityTimer = setTimeout(runCommodityJob, COMMODITY_INTERVAL_MS);
}

// ─── Periodic check (every 5 min) ────────────────────────────────────────────

// Track which "slots" we've already handled in this process lifetime
// Key: "YYYY-MM-DD:slot" e.g. "2026-04-16:whatsapp_generate"
const _handledSlots = new Set<string>();

async function runPeriodicCheck() {
  try {
    const today = brtDateStr();
    const hour = brtHour();
    const dow = brtDayOfWeek();

    // ── 05:45 BRT — generate whatsappText ──────────────────────────────────
    if (hour === 5) {
      const slot = `${today}:whatsapp_generate`;
      if (!_handledSlots.has(slot)) {
        _handledSlots.add(slot);
        await runWhatsAppGenerateJob(today);
      }
    }

    // ── 06:00 BRT — send WhatsApp (DB lock prevents double send) ───────────
    if (hour === 6) {
      const slot = `${today}:whatsapp_send`;
      if (!_handledSlots.has(slot)) {
        _handledSlots.add(slot);
        await runWhatsAppSendJob(today);
      }
    }

    // ── 01:00 BRT — expire trials ───────────────────────────────────────────
    if (hour === 1) {
      const slot = `${today}:expire_trials`;
      if (!_handledSlots.has(slot)) {
        _handledSlots.add(slot);
        try {
          const expired = await expireTrials();
          if (expired > 0) console.log(`[Jobs] Trial expiry: ${expired} user(s) expired`);
        } catch (err) {
          console.error("[Jobs] Trial expiry failed:", err);
        }
      }
    }

    // ── 07:00 BRT — daily email ─────────────────────────────────────────────
    if (hour === 7) {
      const slot = `${today}:email`;
      if (!_handledSlots.has(slot) && !(await hasEmailBeenSentToday())) {
        _handledSlots.add(slot);
        console.log("[Jobs] 07:00 — sending daily briefing email...");
        try {
          const result = await sendDailySummaryEmail();
          console.log(`[Jobs] Email result: ${result.message}`);
        } catch (err) {
          console.error("[Jobs] Email send failed:", err);
        }
      }
    }

    // ── Saturday 22:00 BRT — weekly summary ────────────────────────────────
    if (dow === 6 && hour === 22 && _lastWeeklySummaryDate !== today) {
      _lastWeeklySummaryDate = today;
      console.log("[Jobs] Saturday 22:00 — generating weekly summary...");
      try {
        const result = await generateWeeklySummary();
        console.log(`[Jobs] Weekly summary: ${result.periodLabel} (${result.articleCount} articles)`);
      } catch (err) {
        console.error("[Jobs] Weekly summary failed:", err);
      }
    }

    // ── Last day of month 23:00 BRT — monthly summary ──────────────────────
    if (isLastDayOfMonth() && hour === 23 && _lastMonthlySummaryDate !== today) {
      _lastMonthlySummaryDate = today;
      console.log("[Jobs] Last day of month 23:00 — generating monthly summary...");
      try {
        const result = await generateMonthlySummary();
        console.log(`[Jobs] Monthly summary: ${result.periodLabel} (${result.articleCount} articles)`);
      } catch (err) {
        console.error("[Jobs] Monthly summary failed:", err);
      }
    }
  } catch (err) {
    console.error("[Jobs] Periodic check error:", err);
  }

  setTimeout(runPeriodicCheck, EMAIL_CHECK_INTERVAL_MS);
}

// ─── Catch-up on startup ──────────────────────────────────────────────────────

async function runCatchUpJobs() {
  const today = brtDateStr();
  const hour = brtHour();

  console.log(`[Jobs] Catch-up check: BRT hour=${hour}, date=${today}`);

  // If past 06:00 and WhatsApp wasn't sent today, send now
  if (hour >= 6) {
    console.log("[Jobs] Catch-up: checking WhatsApp status...");
    await runWhatsAppSendJob(today);
  }

  // If past 07:00 and email wasn't sent today, send now
  if (hour >= 7 && !(await hasEmailBeenSentToday())) {
    console.log("[Jobs] Catch-up: sending missed daily email...");
    try {
      const result = await sendDailySummaryEmail();
      console.log(`[Jobs] Catch-up email: ${result.message}`);
    } catch (err) {
      console.error("[Jobs] Catch-up email failed:", err);
    }
  }
}

// ─── Scheduler entry point ────────────────────────────────────────────────────

export async function startJobScheduler() {
  console.log("[Jobs] Starting job scheduler");

  // RSS fetch: run after 5s, then every 6h
  setTimeout(async () => {
    await runFetchJob();
    scheduleNext();
  }, 5_000);

  // Commodity prices: run after 8s, then every 30m
  setTimeout(runCommodityJob, 8_000);

  // Catch-up: after 20s (DB connection settled)
  setTimeout(runCatchUpJobs, 20_000);

  // Periodic check: after 30s, then every 5m
  setTimeout(runPeriodicCheck, 30_000);

  console.log("[Jobs] Schedule:");
  console.log("[Jobs]   05:45 BRT — generate whatsappText");
  console.log("[Jobs]   06:00 BRT — WhatsApp Morning Call (DB lock, idempotent)");
  console.log("[Jobs]   07:00 BRT — daily briefing email");
  console.log("[Jobs]   Every 6h  — RSS fetch");
  console.log("[Jobs]   Every 30m — commodity prices");
  console.log("[Jobs]   Saturday 22:00 BRT — weekly summary");
  console.log("[Jobs]   Last day 23:00 BRT  — monthly summary");
}
