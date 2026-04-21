import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, publisherProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  getAllFeeds,
  insertFeed,
  updateFeedActive,
  deleteFeed,
  getArticles,
  getArticleStats,
  getLatestSummary,
  getSummaryByDate,
  getRecentSummaries,
  getRecentJobLogs,
  getDb,
} from "./db";
import { runFetchJob, getJobStatus } from "./jobs";
import { generateDailySummary, generateWeeklySummary, generateMonthlySummary, getLatestPeriodicSummary, getRecentPeriodicSummaries, generateCustomPeriodSummary, getRecentCustomSummaries } from "./summarizer";
import {
  fetchAndSaveAllQuotes,
  getLatestQuotes,
  getStoredHistory,
  fetchHistory,
  COMMODITIES,
} from "./commodities";
import {
  createCheckoutSession,
  createPortalSession,
  getSubscriptionInfo,
} from "./subscription";
import { PLANS } from "./stripe-products";
import { sendDailySummaryEmail, hasEmailBeenSentToday, buildBriefingEmailForSummary } from "./emailSummary";
import { generateLinkedInPost, generateContentImage, generateWhatsAppMessage, type ImageVariant } from "./contentGenerator";
import { updateUserProfile, getWhatsAppSubscribers, insertWhatsappLog } from "./db";
import { sendMorningCallWhatsApp, buildCommodityBlock, buildMorningCallMessage } from "./whatsappService";
import { generateAutoWhatsAppText, getAutoSendHistory } from "./whatsappAutoGenerator";
import { validateAccessToken, peekAccessToken } from "./whatsappTokenService";
import { getSetting, setSetting, getAllSettings } from "./systemSettings";

// Format a DATE field from the DB correctly — mysql2 returns UTC midnight (00:00Z)
// which toLocaleDateString() on a UTC-4 server would shift to the previous day.
// We extract the YYYY-MM-DD part from the ISO string to avoid any timezone offset.
function formatDateUTC(d: Date | string): string {
  const iso = d instanceof Date ? d.toISOString() : new Date(d).toISOString();
  const [y, m, day] = iso.split("T")[0].split("-");
  return `${day}/${m}/${y}`;
}

const CATEGORY_VALUES = [
  "mercado",
  "commodities",
  "clima",
  "politica_agricola",
  "tecnologia",
  "internacional",
  "geral",
] as const;

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── User Profile (onboarding) ──────────────────────────────────────────────────
  profile: router({
    update: protectedProcedure
      .input(
        z.object({
          name: z.string().min(2).max(128),
          phone: z.string().min(10).max(20).regex(/^\d+$/, "Apenas dígitos (ex: 5561999999999)"),
          whatsappOptIn: z.boolean().default(true),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await updateUserProfile(ctx.user.id, input);
        return { success: true };
      }),
  }),

  // ─── WhatsApp Admin ────────────────────────────────────────────────────────────────
  whatsapp: router({
    // List ALL active/trialing subscribers (admin only) — includes those without phone
    subscribers: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new Error("Forbidden");
      const db = await getDb();
      if (!db) return [];
      const { users: usersTable } = await import("../drizzle/schema");
      const { sql: sqlOp } = await import("drizzle-orm");
      return db
        .select()
        .from(usersTable)
        .where(
          sqlOp`(${usersTable.subscriptionStatus} = 'active' OR ${usersTable.subscriptionStatus} = 'trialing')`
        );
    }),

    // Get the commodity quotes block in CME/ICE format (used by admin preview)
    commodityBlock: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new Error("Forbidden");
      const block = await buildCommodityBlock();
      return { block };
    }),

    // Get the latest WhatsApp text preview for the admin page
    // Returns the FULL message exactly as it will be sent to subscribers
    preview: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new Error("Forbidden");
      const db = await getDb();
      if (!db) return null;

      // 1. Try to get today's auto-generated text first (whatsapp_auto_sends)
      const { whatsappAutoSends } = await import("../drizzle/schema");
      const { desc: descOp, isNotNull: isNotNullOp, sql: sqlOp2 } = await import("drizzle-orm");

      // BRT date string for today
      const now = new Date();
      const brtNow = new Date(now.getTime() - 3 * 60 * 60 * 1000);
      const todayBRT = brtNow.toISOString().slice(0, 10);

      const autoRows = await db
        .select()
        .from(whatsappAutoSends)
        .where(sqlOp2`${whatsappAutoSends.sendDate} = ${todayBRT}`)
        .limit(1);

      let bodyText: string | null = null;
      let sourceLabel = "";

      if (autoRows.length > 0 && autoRows[0].generatedText) {
        bodyText = autoRows[0].generatedText;
        sourceLabel = `auto (${autoRows[0].status})`;
      } else {
        // Fallback: use daily_summaries whatsappText
        const { dailySummaries: ds } = await import("../drizzle/schema");
        const rows = await db
          .select()
          .from(ds)
          .where(isNotNullOp(ds.whatsappText))
          .orderBy(descOp(ds.generatedAt))
          .limit(1);
        if (rows[0]?.whatsappText) {
          bodyText = rows[0].whatsappText;
          sourceLabel = "daily_summary";
        }
      }

      if (!bodyText) return null;

      // 2. Build the FULL message exactly as sent to subscribers
      // Use prevClose=true for preview (matches the 06:00 scheduled send)
      const fullMessage = await buildMorningCallMessage(
        ctx.user.name ?? "Assinante",
        bodyText,
        null, // no token for preview — shows generic link
        undefined,
        true // usePrevClose = true (matches scheduled send)
      );

      return {
        fullMessage,
        bodyText,
        sourceLabel,
        generatedAt: autoRows[0]?.createdAt ?? null,
      };
    }),

    // Manually trigger a Morning Call send (admin only, for testing)
    sendNow: protectedProcedure
      .input(z.object({ userId: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new Error("Forbidden");
        const result = await sendMorningCallWhatsApp(input.userId);
        return result;
      }),
    // Get history of automatic sends (admin only)
    autoHistory: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new Error("Forbidden");
      return getAutoSendHistory(30);
    }),
    // Manually trigger auto-text generation (admin only)
    generateNow: protectedProcedure.mutation(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new Error("Forbidden");
      return generateAutoWhatsAppText();
    }),

    // Send WhatsApp using the Esteira de Conteúdo text (admin only, manual dispatch)
    sendFromContent: protectedProcedure
      .input(z.object({ summaryId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { dailySummaries: ds } = await import("../drizzle/schema");
        const { eq: eqOp } = await import("drizzle-orm");
        const rows = await db.select().from(ds).where(eqOp(ds.id, input.summaryId)).limit(1);
        if (!rows.length) throw new Error("Resumo não encontrado");
        const whatsappText = rows[0].whatsappText;
        if (!whatsappText) throw new Error("Texto WhatsApp ainda não foi gerado para este resumo. Gere o texto antes de enviar.");
        // Send using the Esteira text as override (real-time quotes, not prevClose)
        const result = await sendMorningCallWhatsApp(undefined, whatsappText, false);
        return result;
      }),

    // Validate a WhatsApp access token (public — called from /acesso page)
    validateToken: publicProcedure
      .input(z.object({ token: z.string().min(1).max(128) }))
      .mutation(async ({ input }) => {
        const result = await validateAccessToken(input.token);
        if (!result.valid) {
          return { valid: false, reason: result.reason };
        }
        // Fetch user subscription status
        const db = await getDb();
        if (!db) return { valid: false, reason: "not_found" as const };
        const { users: usersTable } = await import("../drizzle/schema");
        const { eq: eqOp } = await import("drizzle-orm");
        const rows = await db
          .select()
          .from(usersTable)
          .where(eqOp(usersTable.id, result.userId!))
          .limit(1);
        const user = rows[0];
        if (!user) return { valid: false, reason: "not_found" as const };
        const isActive =
          user.subscriptionStatus === "active" ||
          user.subscriptionStatus === "trialing" ||
          user.role === "admin";
        return {
          valid: true,
          isSubscriber: isActive,
          userId: user.id,
          userName: user.name,
        };
      }),

    // Peek at a token without consuming it (used for display)
    peekToken: publicProcedure
      .input(z.object({ token: z.string().min(1).max(128) }))
      .query(async ({ input }) => {
        return peekAccessToken(input.token);
      }),
  }),

  // ─── RSS Feeds ───────────────────────────────────────────────────────────────
  feeds: router({
    list: publicProcedure.query(async () => {
      return getAllFeeds();
    }),

    add: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1).max(255),
          url: z.string().url().max(1024),
          category: z.enum(CATEGORY_VALUES).default("geral"),
        })
      )
      .mutation(async ({ input }) => {
        await insertFeed(input);
        return { success: true };
      }),

    toggleActive: protectedProcedure
      .input(z.object({ id: z.number(), active: z.boolean() }))
      .mutation(async ({ input }) => {
        await updateFeedActive(input.id, input.active);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteFeed(input.id);
        return { success: true };
      }),
  }),

  // ─── Articles ────────────────────────────────────────────────────────────────
  articles: router({
    list: publicProcedure
      .input(
        z.object({
          feedIds: z.array(z.number()).optional(),
          categories: z.array(z.enum(CATEGORY_VALUES)).optional(),
          search: z.string().max(200).optional(),
          dateFrom: z.date().optional(),
          dateTo: z.date().optional(),
          limit: z.number().min(1).max(100).default(50),
          offset: z.number().min(0).default(0),
        })
      )
      .query(async ({ input }) => {
        return getArticles(input);
      }),

    stats: publicProcedure.query(async () => {
      return getArticleStats();
    }),
  }),

  // ─── Daily Summaries ─────────────────────────────────────────────────────────
  summaries: router({
    latest: publicProcedure.query(async () => {
      return getLatestSummary();
    }),

    byDate: publicProcedure
      .input(z.object({ date: z.date() }))
      .query(async ({ input }) => {
        return getSummaryByDate(input.date);
      }),

    recent: publicProcedure
      .input(z.object({ limit: z.number().min(1).max(30).default(7) }))
      .query(async ({ input }) => {
        return getRecentSummaries(input.limit);
      }),

    generate: protectedProcedure
      .input(z.object({ date: z.date().optional() }))
      .mutation(async ({ input }) => {
        const result = await generateDailySummary(input.date);
        return result;
      }),

    // ─── Periodic (weekly / monthly) ───────────────────────────────────────────
    latestPeriodic: publicProcedure
      .input(z.object({ type: z.enum(["weekly", "monthly"]) }))
      .query(async ({ input }) => {
        return getLatestPeriodicSummary(input.type);
      }),

    recentPeriodic: publicProcedure
      .input(
        z.object({
          type: z.enum(["weekly", "monthly"]),
          limit: z.number().min(1).max(24).default(12),
        })
      )
      .query(async ({ input }) => {
        return getRecentPeriodicSummaries(input.type, input.limit);
      }),

    generateWeekly: protectedProcedure
      .input(z.object({ date: z.date().optional() }))
      .mutation(async ({ input }) => {
        return generateWeeklySummary(input.date);
      }),

    generateMonthly: protectedProcedure
      .input(z.object({ date: z.date().optional() }))
      .mutation(async ({ input }) => {
        return generateMonthlySummary(input.date);
      }),
    // ─── Custom Period ──────────────────────────────────────────────────────────
    recentCustom: publicProcedure
      .input(z.object({ limit: z.number().min(1).max(50).default(20) }))
      .query(async ({ input }) => {
        return getRecentCustomSummaries(input.limit);
      }),
    generateCustomPeriod: protectedProcedure
      .input(z.object({ dateFrom: z.date(), dateTo: z.date() }))
      .mutation(async ({ input }) => {
        return generateCustomPeriodSummary(input.dateFrom, input.dateTo);
      }),
  }),

  // ─── Commodities ─────────────────────────────────────────────────────────────────────────────────
  commodities: router({
    // Get latest quotes from DB (fast, no external call)
    quotes: publicProcedure.query(async () => {
      return getLatestQuotes();
    }),

    // Refresh quotes from Yahoo Finance and save to DB
    refresh: protectedProcedure.mutation(async () => {
      const quotes = await fetchAndSaveAllQuotes();
      return quotes;
    }),

    // Get historical data for a symbol from Yahoo Finance
    history: publicProcedure
      .input(
        z.object({
          symbol: z.string(),
          range: z.enum(["1mo", "3mo", "6mo", "1y"]).default("3mo"),
        })
      )
      .query(async ({ input }) => {
        const history = await fetchHistory(input.symbol, input.range);
        return history;
      }),

    // Get stored history from DB
    storedHistory: publicProcedure
      .input(z.object({ symbol: z.string(), days: z.number().default(30) }))
      .query(async ({ input }) => {
        return getStoredHistory(input.symbol, input.days);
      }),

    // List available commodities
    list: publicProcedure.query(() => {
      return COMMODITIES.map((c) => ({ ...c }));
    }),
  }),

  // ─── Subscription ──────────────────────────────────────────────────────────
  subscription: router({
    // Get current user's subscription status
    status: publicProcedure.query(async ({ ctx }) => {
      return getSubscriptionInfo(ctx.user);
    }),

    // List all available plans
    plans: publicProcedure.query(() => {
      return PLANS.map((p) => ({
        id: p.id,
        name: p.name,
        tagline: p.tagline,
        description: p.description,
        priceMonthly: p.priceMonthly,
        features: p.features,
        notIncluded: p.notIncluded ?? [],
        highlight: p.highlight ?? false,
        badge: p.badge ?? null,
      }));
    }),

    // Create Stripe Checkout session
    createCheckout: protectedProcedure
      .input(
        z.object({
          planId: z.enum(["morning_call", "corporativo", "agro_publisher"]),
          origin: z.string().url(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const url = await createCheckoutSession(ctx.user!, input.planId, input.origin);
        return { url };
      }),

    // Create Stripe Customer Portal session
    createPortal: protectedProcedure
      .input(z.object({ origin: z.string().url() }))
      .mutation(async ({ ctx, input }) => {
        const url = await createPortalSession(ctx.user!, input.origin);
        return { url };
      }),
  }),

  // ─── Job Control ─────────────────────────────────────────────────────────────────────────────────
  jobs: router({
    status: publicProcedure.query(async () => {
      return getJobStatus();
    }),

    runNow: protectedProcedure.mutation(async () => {
      const result = await runFetchJob();
      return result;
    }),

    logs: publicProcedure
      .input(z.object({ limit: z.number().min(1).max(50).default(20) }))
      .query(async ({ input }) => {
        return getRecentJobLogs(input.limit);
      }),
  }),

  // ─── Content (Fase 1 — Esteira de Conteúdo) ────────────────────────────────
  content: router({
    // Buscar o conteúdo com paginação — requer plano agro_publisher ou admin
    getLatest: publisherProcedure
      .input(z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(50).default(10),
      }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { dailySummaries: ds } = await import("../drizzle/schema");
        const { desc: descOp, sql: sqlOp } = await import("drizzle-orm");
        const page = input?.page ?? 1;
        const pageSize = input?.pageSize ?? 10;
        const offset = (page - 1) * pageSize;
        const rows = await db
          .select()
          .from(ds)
          .orderBy(descOp(ds.summaryDate), descOp(ds.generatedAt))
          .limit(pageSize)
          .offset(offset);
        const countResult = await db.select({ count: sqlOp<number>`count(*)` }).from(ds);
        const total = Number(countResult[0]?.count ?? 0);
        return { rows, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
      }),

    approve: publisherProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { dailySummaries: ds } = await import("../drizzle/schema");
        const { eq: eqOp } = await import("drizzle-orm");
        await db
          .update(ds)
          .set({ approvalStatus: "approved", approvedAt: new Date() })
          .where(eqOp(ds.id, input.id));
        return { success: true };
      }),

    reject: publisherProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { dailySummaries: ds } = await import("../drizzle/schema");
        const { eq: eqOp } = await import("drizzle-orm");
        await db
          .update(ds)
          .set({ approvalStatus: "rejected" })
          .where(eqOp(ds.id, input.id));
        return { success: true };
      }),

    regeneratePost: publisherProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { dailySummaries: ds } = await import("../drizzle/schema");
        const { eq: eqOp } = await import("drizzle-orm");
        const rows = await db.select().from(ds).where(eqOp(ds.id, input.id)).limit(1);
        if (!rows.length) throw new Error("Resumo não encontrado");
        const row = rows[0];
        const highlights = JSON.parse(row.highlights ?? "[]");
        const dateStr = formatDateUTC(row.summaryDate);
        const linkedinPost = await generateLinkedInPost(row.content, highlights, dateStr);
        await db.update(ds).set({ linkedinPost, approvalStatus: "pending_approval" }).where(eqOp(ds.id, input.id));
        return { linkedinPost };
      }),

    regenerateImage: publisherProcedure
      .input(z.object({
        id: z.number(),
        variant: z.enum(["padrao", "autoridade", "financeiro", "agro"]).default("padrao"),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { dailySummaries: ds } = await import("../drizzle/schema");
        const { eq: eqOp } = await import("drizzle-orm");
        const rows = await db.select().from(ds).where(eqOp(ds.id, input.id)).limit(1);
        if (!rows.length) throw new Error("Resumo não encontrado");
        const row = rows[0];
        const highlights = JSON.parse(row.highlights ?? "[]");
        const dateStr = formatDateUTC(row.summaryDate);
        const { url: imageUrl, prompt: imagePrompt } = await generateContentImage(highlights, dateStr, input.variant as ImageVariant);
        await db.update(ds).set({ imageUrl, imagePrompt, approvalStatus: "pending_approval" }).where(eqOp(ds.id, input.id));
        return { imageUrl };
      }),

    generateWhatsApp: publisherProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { dailySummaries: ds } = await import("../drizzle/schema");
        const { eq: eqOp } = await import("drizzle-orm");
        const rows = await db.select().from(ds).where(eqOp(ds.id, input.id)).limit(1);
        if (!rows.length) throw new Error("Resumo não encontrado");
        const row = rows[0];
        const highlights = JSON.parse(row.highlights ?? "[]");
        const dateStr = formatDateUTC(row.summaryDate);
        const whatsappMessage = await generateWhatsAppMessage(row.content, highlights, dateStr);
        await db.update(ds).set({ whatsappText: whatsappMessage }).where(eqOp(ds.id, input.id));
        return { whatsappMessage };
      }),

    generateForSummary: publisherProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { dailySummaries: ds } = await import("../drizzle/schema");
        const { eq: eqOp } = await import("drizzle-orm");
        const rows = await db.select().from(ds).where(eqOp(ds.id, input.id)).limit(1);
        if (!rows.length) throw new Error("Resumo não encontrado");
        const row = rows[0];
        const highlights = JSON.parse(row.highlights ?? "[]");
        const dateStr = formatDateUTC(row.summaryDate);
        const [linkedinPost, imgResult] = await Promise.all([
          generateLinkedInPost(row.content, highlights, dateStr),
          generateContentImage(highlights, dateStr),
        ]);
        await db.update(ds).set({
          linkedinPost,
          imageUrl: imgResult.url,
          imagePrompt: imgResult.prompt,
          approvalStatus: "pending_approval",
        }).where(eqOp(ds.id, input.id));
        return { linkedinPost, imageUrl: imgResult.url };
      }),
  }),

  // ─── Email Summary ────────────────────────────────────────────────────────────────────────────
  email: router({
    // Send briefing email for a specific summary (from content approval panel)
    sendBriefingEmail: publisherProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { dailySummaries: ds } = await import("../drizzle/schema");
        const { eq: eqOp } = await import("drizzle-orm");
        const rows = await db.select().from(ds).where(eqOp(ds.id, input.id)).limit(1);
        if (!rows.length) throw new Error("Resumo n\u00e3o encontrado");
        const row = rows[0];
        const body = await buildBriefingEmailForSummary(row.content, row.articleCount ?? 0);
        const dateStr = formatDateUTC(row.summaryDate);
        // A API de notificação tem limite de 20.000 caracteres — truncamos com margem segura
        const MAX_CHARS = 19000;
        const safeBody = body.length > MAX_CHARS
          ? body.slice(0, MAX_CHARS) +
            `\n\n<hr style="border:none;border-top:1px solid #ccc;margin:16px 0">` +
            `<p style="color:#888;font-size:12px;text-align:center">⚠️ Conteúdo truncado (${body.length.toLocaleString("pt-BR")} caracteres no total). ` +
            `Acesse o painel para visualizar o briefing completo.</p>`
          : body;
        const { notifyOwner } = await import("./_core/notification");
        await notifyOwner({
          title: `📊 Briefing Executivo — ${dateStr}`,
          content: safeBody,
        });
        return { success: true, message: "Briefing enviado por e-mail com sucesso." };
      }),
// Send daily briefing now (for testing or manual trigger)
    sendNow: protectedProcedure
      .input(z.object({ force: z.boolean().default(false) }))
      .mutation(async ({ input }) => {
        const result = await sendDailySummaryEmail(input.force);
        return result;
      }),

    // Check if email was already sent today
    status: publicProcedure.query(() => {
      return {
        sentToday: hasEmailBeenSentToday(),
        scheduledTime: "07:00 BRT",
      };
    }),
  }),

  // ─── Commercial Dashboard (admin-only) ──────────────────────────────────────────────────────────────────────────────────
  commercial: router({
    // Overview KPIs: MRR, ARR, users, orgs, subscriptions
    overview: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const { getCommercialOverview } = await import("./commercialMetrics");
      return getCommercialOverview();
    }),

    // Subscription breakdown by plan and status
    subscriptionGroups: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const { getSubscriptionGroups } = await import("./commercialMetrics");
      return getSubscriptionGroups();
    }),

    // All users list
    users: protectedProcedure
      .input(z.object({ limit: z.number().default(100) }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { getAllUsers } = await import("./commercialMetrics");
        return getAllUsers(input.limit);
      }),

    // All organizations
    organizations: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const { getAllOrgs } = await import("./commercialMetrics");
      return getAllOrgs();
    }),

    // MRR history by month
    mrrHistory: protectedProcedure
      .input(z.object({ months: z.number().default(6) }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { getMrrHistory } = await import("./commercialMetrics");
        return getMrrHistory(input.months);
      }),

    // Hourly usage distribution (access hours)
    hourlyUsage: protectedProcedure
      .input(z.object({ days: z.number().default(7) }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { getHourlyUsage } = await import("./commercialMetrics");
        return getHourlyUsage(input.days);
      }),

    // Top features used
    topFeatures: protectedProcedure
      .input(z.object({ days: z.number().default(30) }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { getTopFeatures } = await import("./commercialMetrics");
        return getTopFeatures(input.days);
      }),

    // Top pages visited
    topPages: protectedProcedure
      .input(z.object({ days: z.number().default(30) }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { getTopPages } = await import("./commercialMetrics");
        return getTopPages(input.days);
      }),

    // Track a usage event (called from frontend)
    trackEvent: protectedProcedure
      .input(z.object({
        eventType: z.string(),
        page: z.string().optional(),
        feature: z.string().optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { trackUsageEvent } = await import("./commercialMetrics");
        await trackUsageEvent(ctx.user.id, input.eventType, input.page, input.feature, input.metadata as Record<string, unknown> | undefined);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
