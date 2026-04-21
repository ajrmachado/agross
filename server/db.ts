import { and, desc, eq, gte, inArray, isNotNull, like, lt, or, sql, count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  Article,
  articles,
  dailySummaries,
  InsertRssFeed,
  InsertUser,
  jobLogs,
  rssFeeds,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;
  textFields.forEach((field) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  });

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  // Handle subscription fields for new users (trial setup)
  if (user.subscriptionStatus !== undefined) {
    values.subscriptionStatus = user.subscriptionStatus;
    // Don't put subscriptionStatus in updateSet — we don't want to overwrite existing subscriptions
  }
  if (user.trialEndsAt !== undefined) {
    values.trialEndsAt = user.trialEndsAt;
    // Don't put trialEndsAt in updateSet — only set on first registration
  }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserProfile(
  userId: number,
  data: { name: string; phone: string; whatsappOptIn: boolean }
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(users)
    .set({
      name: data.name,
      phone: data.phone,
      whatsappOptIn: data.whatsappOptIn,
      profileCompleted: true,
    })
    .where(eq(users.id, userId));
}

export async function getWhatsAppSubscribers() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(users)
    .where(
      and(
        eq(users.whatsappOptIn, true),
        isNotNull(users.phone),
        // subscriptionStatus active or trialing
        sql`(${users.subscriptionStatus} = 'active' OR ${users.subscriptionStatus} = 'trialing')`
      )
    );
}

export async function insertWhatsappLog(data: {
  userId: number;
  phone: string;
  messageType: string;
  status: "sent" | "failed" | "skipped";
  errorMessage?: string;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const { whatsappLogs } = await import("../drizzle/schema");
  await db.insert(whatsappLogs).values({
    userId: data.userId,
    phone: data.phone,
    messageType: data.messageType,
    status: data.status,
    errorMessage: data.errorMessage ?? null,
  });
}

/**
 * Expire trials: find users with status='trialing' whose trialEndsAt has passed
 * and update their subscriptionStatus to 'expired'.
 * Returns the number of users expired.
 */
export async function expireTrials(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const now = new Date();
  const result = await db
    .update(users)
    .set({ subscriptionStatus: "expired" })
    .where(
      and(
        eq(users.subscriptionStatus, "trialing"),
        isNotNull(users.trialEndsAt),
        sql`${users.trialEndsAt} <= ${now}`
      )
    );
  const affected = (result as unknown as [{ affectedRows?: number }])[0]?.affectedRows ?? 0;
  return affected;
}

// ─── RSS Feeds ────────────────────────────────────────────────────────────────

export const DEFAULT_FEEDS: InsertRssFeed[] = [
  // ── Feeds verificados e funcionando ──────────────────────────────────────────
  {
    name: "Agro Estadão",
    url: "https://agro.estadao.com.br/feed",
    category: "mercado",
  },
  {
    name: "Safras & Mercado",
    url: "https://www.safras.com.br/feed/",
    category: "commodities",
  },
  {
    name: "The Agribiz",
    url: "https://www.theagribiz.com/feed/",
    category: "mercado",
  },
  {
    name: "Campo & Negócios",
    url: "https://campoenegocios.com/feed",
    category: "mercado",
  },
  {
    name: "Agência Brasil - Economia",
    url: "https://agenciabrasil.ebc.com.br/rss/economia/feed.xml",
    category: "mercado",
  },
  {
    name: "Farm Progress",
    url: "https://www.farmprogress.com/rss.xml",
    category: "internacional",
  },
  // ── Google News RSS (cobertura ampla, sem bloqueio de IP) ──────────────────
  {
    name: "Google News - Agronegócio Brasil",
    url: "https://news.google.com/rss/search?q=agronegocio+brasil&hl=pt-BR&gl=BR&ceid=BR:pt-419",
    category: "mercado",
  },
  {
    name: "Google News - Soja e Milho",
    url: "https://news.google.com/rss/search?q=soja+milho+commodities+brasil&hl=pt-BR&gl=BR&ceid=BR:pt-419",
    category: "commodities",
  },
  {
    name: "Google News - Clima Agrícola",
    url: "https://news.google.com/rss/search?q=clima+safra+agricultura+brasil&hl=pt-BR&gl=BR&ceid=BR:pt-419",
    category: "clima",
  },
  {
    name: "Google News - Crédito Rural",
    url: "https://news.google.com/rss/search?q=credito+rural+financiamento+agro+brasil&hl=pt-BR&gl=BR&ceid=BR:pt-419",
    category: "politica_agricola",
  },
  {
    name: "NOAA Weather RSS",
    url: "https://www.weather.gov/rss_page.php?site_name=nws",
    category: "clima",
  },
  // ── Feeds desativados por padrão (bloqueiam por IP de servidor) ─────────────
  // Estes feeds retornam 403/404 em ambientes de servidor cloud.
  // Podem ser reativados manualmente se o acesso for liberado.
  {
    name: "Notícias Agrícolas",
    url: "https://www.noticiasagricolas.com.br/rss",
    category: "mercado",
    active: false,
  },
  {
    name: "Canal Rural",
    url: "https://www.canalrural.com.br/rss",
    category: "politica_agricola",
    active: false,
  },
  {
    name: "Agrolink",
    url: "https://www.agrolink.com.br/rss/noticias.xml",
    category: "tecnologia",
    active: false,
  },
  {
    name: "CEPEA / ESALQ",
    url: "https://www.cepea.org.br/br/rss.aspx",
    category: "commodities",
    active: false,
  },
  {
    name: "USDA Blog",
    url: "https://www.usda.gov/media/blog/rss.xml",
    category: "internacional",
    active: false,
  },
  {
    name: "IMEA",
    url: "https://imea.com.br/imea-site/feed",
    category: "commodities",
    active: false,
  },
  {
    name: "CNA Brasil",
    url: "https://www.cnabrasil.org.br/rss",
    category: "politica_agricola",
    active: false,
  },
];

export async function seedDefaultFeeds(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const existing = await db.select({ url: rssFeeds.url }).from(rssFeeds);
  const existingUrls = new Set(existing.map((r) => r.url));

  const toInsert = DEFAULT_FEEDS.filter((f) => !existingUrls.has(f.url));
  if (toInsert.length > 0) {
    await db.insert(rssFeeds).values(toInsert);
    console.log(`[DB] Seeded ${toInsert.length} default RSS feeds`);
  }
}

export async function getAllFeeds() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(rssFeeds).orderBy(rssFeeds.name);
}

export async function getFeedById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(rssFeeds).where(eq(rssFeeds.id, id)).limit(1);
  return result[0] ?? null;
}

export async function insertFeed(feed: InsertRssFeed) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(rssFeeds).values(feed);
}

export async function updateFeedActive(id: number, active: boolean) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(rssFeeds).set({ active }).where(eq(rssFeeds.id, id));
}

export async function deleteFeed(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(rssFeeds).where(eq(rssFeeds.id, id));
}

// ─── Articles ─────────────────────────────────────────────────────────────────

export type ArticleFilters = {
  feedIds?: number[];
  categories?: string[];
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
};

export async function getArticles(filters: ArticleFilters = {}): Promise<{
  items: Article[];
  total: number;
}> {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const { feedIds, categories, search, dateFrom, dateTo, limit = 50, offset = 0 } = filters;

  const conditions = [];
  if (feedIds && feedIds.length > 0) conditions.push(inArray(articles.feedId, feedIds));
  if (categories && categories.length > 0)
    conditions.push(inArray(articles.category, categories as Article["category"][]));
  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    conditions.push(or(like(articles.title, term), like(articles.description, term)));
  }
  if (dateFrom) conditions.push(gte(articles.publishedAt, dateFrom));
  if (dateTo) conditions.push(lt(articles.publishedAt, dateTo));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [items, [{ total }]] = await Promise.all([
    db
      .select()
      .from(articles)
      .where(where)
      .orderBy(desc(articles.publishedAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(articles).where(where),
  ]);

  return { items, total: Number(total) };
}

export async function getArticleStats() {
  const db = await getDb();
  if (!db) return { total: 0, today: 0, byCategory: [], bySource: [] };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [totalResult, todayResult, byCategoryResult, bySourceResult] = await Promise.all([
    db.select({ total: count() }).from(articles),
    db.select({ total: count() }).from(articles).where(gte(articles.createdAt, todayStart)),
    db
      .select({ category: articles.category, total: count() })
      .from(articles)
      .groupBy(articles.category),
    db
      .select({ source: articles.source, total: count() })
      .from(articles)
      .groupBy(articles.source)
      .orderBy(desc(count()))
      .limit(10),
  ]);

  return {
    total: Number(totalResult[0]?.total ?? 0),
    today: Number(todayResult[0]?.total ?? 0),
    byCategory: byCategoryResult.map((r) => ({ category: r.category, total: Number(r.total) })),
    bySource: bySourceResult.map((r) => ({ source: r.source, total: Number(r.total) })),
  };
}

// ─── Daily Summaries ──────────────────────────────────────────────────────────

export async function getLatestSummary() {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(dailySummaries)
    .orderBy(desc(dailySummaries.summaryDate))
    .limit(1);
  return result[0] ?? null;
}

export async function getSummaryByDate(date: Date) {
  const db = await getDb();
  if (!db) return null;
  const dateKey = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const result = await db
    .select()
    .from(dailySummaries)
    .where(eq(dailySummaries.summaryDate, dateKey))
    .limit(1);
  return result[0] ?? null;
}

export async function getRecentSummaries(limit = 7) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(dailySummaries)
    .orderBy(desc(dailySummaries.summaryDate))
    .limit(limit);
}

// ─── Job Logs ─────────────────────────────────────────────────────────────────

export async function getRecentJobLogs(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(jobLogs).orderBy(desc(jobLogs.startedAt)).limit(limit);
}
