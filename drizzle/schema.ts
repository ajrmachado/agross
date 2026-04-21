import {
  boolean,
  decimal,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  date,
  index,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),          // WhatsApp number with country code e.g. 5561999999999
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  profileCompleted: boolean("profileCompleted").default(false).notNull(), // true after onboarding
  whatsappOptIn: boolean("whatsappOptIn").default(true).notNull(),         // consent to receive WhatsApp
  stripeCustomerId: varchar("stripeCustomerId", { length: 128 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 128 }),
  subscriptionPlan: mysqlEnum("subscriptionPlan", ["morning_call", "corporativo", "agro_publisher"]),
  subscriptionStatus: varchar("subscriptionStatus", { length: 32 }), // active, canceled, past_due, trialing
  subscriptionEndsAt: timestamp("subscriptionEndsAt"),
  trialEndsAt: timestamp("trialEndsAt"),  // set on first login; after 7 days → status becomes expired
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── RSS Feeds ────────────────────────────────────────────────────────────────

export const rssFeeds = mysqlTable("rss_feeds", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  url: varchar("url", { length: 1024 }).notNull().unique(),
  category: mysqlEnum("category", [
    "mercado",
    "commodities",
    "clima",
    "politica_agricola",
    "tecnologia",
    "internacional",
    "geral",
  ])
    .default("geral")
    .notNull(),
  active: boolean("active").default(true).notNull(),
  lastFetchedAt: timestamp("lastFetchedAt"),
  fetchErrorCount: int("fetchErrorCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type RssFeed = typeof rssFeeds.$inferSelect;
export type InsertRssFeed = typeof rssFeeds.$inferInsert;

// ─── Articles ─────────────────────────────────────────────────────────────────

export const articles = mysqlTable(
  "articles",
  {
    id: int("id").autoincrement().primaryKey(),
    feedId: int("feedId")
      .notNull()
      .references(() => rssFeeds.id, { onDelete: "cascade" }),
    guid: varchar("guid", { length: 1024 }).notNull(),
    title: varchar("title", { length: 1024 }).notNull(),
    description: text("description"),
    link: varchar("link", { length: 1024 }),
    source: varchar("source", { length: 255 }).notNull(),
    category: mysqlEnum("category", [
      "mercado",
      "commodities",
      "clima",
      "politica_agricola",
      "tecnologia",
      "internacional",
      "geral",
    ])
      .default("geral")
      .notNull(),
    publishedAt: timestamp("publishedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [
    index("idx_articles_feedId").on(t.feedId),
    index("idx_articles_publishedAt").on(t.publishedAt),
    index("idx_articles_category").on(t.category),
    index("idx_articles_guid").on(t.guid),
  ]
);

export type Article = typeof articles.$inferSelect;
export type InsertArticle = typeof articles.$inferInsert;

// ─── Daily Summaries ──────────────────────────────────────────────────────────

export const dailySummaries = mysqlTable("daily_summaries", {
  id: int("id").autoincrement().primaryKey(),
  summaryDate: date("summaryDate").notNull().unique(),
  content: text("content").notNull(),
  articleCount: int("articleCount").default(0).notNull(),
  highlights: text("highlights"),
  // ─── Fase 1: Esteira de Conteúdo ─────────────────────────────────────────
  linkedinPost: text("linkedinPost"),           // Post formatado para LinkedIn
  whatsappText: text("whatsappText"),             // Mensagem formatada para WhatsApp
  imageUrl: varchar("imageUrl", { length: 2048 }), // URL da imagem gerada
  imagePrompt: text("imagePrompt"),             // Prompt usado para gerar a imagem
  approvalStatus: mysqlEnum("approvalStatus", ["draft", "pending_approval", "approved", "rejected"])
    .default("draft").notNull(),
  approvedAt: timestamp("approvedAt"),
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DailySummary = typeof dailySummaries.$inferSelect;
export type InsertDailySummary = typeof dailySummaries.$inferInsert;

// ─── Job Logs ─────────────────────────────────────────────────────────────────

export const jobLogs = mysqlTable("job_logs", {
  id: int("id").autoincrement().primaryKey(),
  jobName: varchar("jobName", { length: 128 }).notNull(),
  status: mysqlEnum("status", ["running", "success", "error"]).notNull(),
  message: text("message"),
  articlesAdded: int("articlesAdded").default(0),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  finishedAt: timestamp("finishedAt"),
});

export type JobLog = typeof jobLogs.$inferSelect;
export type InsertJobLog = typeof jobLogs.$inferInsert;

// ─── Commodity Prices ─────────────────────────────────────────────────────────────────────────────────

export const commodityPrices = mysqlTable(
  "commodity_prices",
  {
    id: int("id").autoincrement().primaryKey(),
    symbol: varchar("symbol", { length: 16 }).notNull(),   // ZS=F, ZC=F, ZW=F
    name: varchar("name", { length: 64 }).notNull(),        // Soja, Milho, Trigo
    price: decimal("price", { precision: 12, scale: 4 }).notNull(),
    prevClose: decimal("prevClose", { precision: 12, scale: 4 }),
    change: decimal("change", { precision: 10, scale: 4 }),
    changePct: decimal("changePct", { precision: 8, scale: 4 }),
    currency: varchar("currency", { length: 8 }).default("USX").notNull(),
    exchange: varchar("exchange", { length: 32 }),
    fetchedAt: timestamp("fetchedAt").defaultNow().notNull(),
  },
  (t) => [
    index("idx_commodity_symbol_fetchedAt").on(t.symbol, t.fetchedAt),
  ]
);

export type CommodityPrice = typeof commodityPrices.$inferSelect;
export type InsertCommodityPrice = typeof commodityPrices.$inferInsert;

// ─── Periodic Summaries (weekly / monthly) ───────────────────────────────────

export const periodicSummaries = mysqlTable(
  "periodic_summaries",
  {
    id: int("id").autoincrement().primaryKey(),
    type: mysqlEnum("type", ["weekly", "monthly", "custom"]).notNull(),
    periodLabel: varchar("periodLabel", { length: 64 }).notNull(), // e.g. "2026-W12" or "2026-03"
    periodStart: date("periodStart").notNull(),
    periodEnd: date("periodEnd").notNull(),
    content: text("content").notNull(),
    highlights: text("highlights"),
    articleCount: int("articleCount").default(0).notNull(),
    generatedAt: timestamp("generatedAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [
    index("idx_periodic_type_label").on(t.type, t.periodLabel),
  ]
);

export type PeriodicSummary = typeof periodicSummaries.$inferSelect;
export type InsertPeriodicSummary = typeof periodicSummaries.$inferInsert;

// ─── WhatsApp Send Logs ──────────────────────────────────────────────────────

export const whatsappLogs = mysqlTable(
  "whatsapp_logs",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    phone: varchar("phone", { length: 20 }).notNull(),
    messageType: varchar("messageType", { length: 64 }).default("morning_call").notNull(),
    status: mysqlEnum("status", ["sent", "failed", "skipped"]).notNull(),
    errorMessage: text("errorMessage"),
    sentAt: timestamp("sentAt").defaultNow().notNull(),
  },
  (t) => [
    index("idx_whatsapp_logs_userId").on(t.userId),
    index("idx_whatsapp_logs_sentAt").on(t.sentAt),
  ]
);

export type WhatsappLog = typeof whatsappLogs.$inferSelect;
export type InsertWhatsappLog = typeof whatsappLogs.$inferInsert;

// ─── WhatsApp Auto Sends (histórico de envios automáticos das 06:00 BRT) ────────

export const whatsappAutoSends = mysqlTable(
  "whatsapp_auto_sends",
  {
    id: int("id").autoincrement().primaryKey(),
    sendDate: date("sendDate").notNull().unique(),   // Data do envio (YYYY-MM-DD BRT)
    generatedText: text("generatedText").notNull(),  // Texto gerado pela IA para este envio
    sentAt: timestamp("sentAt"),                     // Quando o envio foi disparado
    totalSent: int("totalSent").default(0).notNull(),
    totalFailed: int("totalFailed").default(0).notNull(),
    totalSkipped: int("totalSkipped").default(0).notNull(),
    status: mysqlEnum("status", ["pending", "sent", "failed"]).default("pending").notNull(),
    errorMessage: text("errorMessage"),
    sentText: text("sentText"),                         // Texto completo exato enviado às 06:00 (com bloco CME/ICE + rodapé)
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [
    index("idx_whatsapp_auto_sends_sendDate").on(t.sendDate),
  ]
);

export type WhatsappAutoSend = typeof whatsappAutoSends.$inferSelect;
export type InsertWhatsappAutoSend = typeof whatsappAutoSends.$inferInsert;

// ─── Organizations (plano Corporativo: até 10 acessos) ──────────────────────

export const organizations = mysqlTable(
  "organizations",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    ownerId: int("ownerId").notNull().references(() => users.id, { onDelete: "cascade" }),
    maxUsers: int("maxUsers").default(10).notNull(),   // Corporativo: 10 acessos
    plan: mysqlEnum("plan", ["morning_call", "corporativo", "agro_publisher"]).default("corporativo").notNull(),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [
    index("idx_organizations_ownerId").on(t.ownerId),
  ]
);

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;

export const organizationMembers = mysqlTable(
  "organization_members",
  {
    id: int("id").autoincrement().primaryKey(),
    orgId: int("orgId").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: mysqlEnum("role", ["owner", "member"]).default("member").notNull(),
    joinedAt: timestamp("joinedAt").defaultNow().notNull(),
  },
  (t) => [
    index("idx_org_members_orgId").on(t.orgId),
    index("idx_org_members_userId").on(t.userId),
  ]
);

export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type InsertOrganizationMember = typeof organizationMembers.$inferInsert;

// ─── Usage Events (rastreamento de uso para o Painel Comercial) ───────────────

export const usageEvents = mysqlTable(
  "usage_events",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").references(() => users.id, { onDelete: "set null" }),
    eventType: varchar("eventType", { length: 64 }).notNull(), // page_view, feature_use, login
    page: varchar("page", { length: 128 }),                    // /dashboard, /resumo, /cotacoes
    feature: varchar("feature", { length: 128 }),              // generate_summary, send_whatsapp
    metadata: text("metadata"),                                // JSON extra data
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [
    index("idx_usage_events_userId").on(t.userId),
    index("idx_usage_events_createdAt").on(t.createdAt),
    index("idx_usage_events_eventType").on(t.eventType),
    index("idx_usage_events_page").on(t.page),
  ]
);

export type UsageEvent = typeof usageEvents.$inferSelect;
export type InsertUsageEvent = typeof usageEvents.$inferInsert;

// ─── WhatsApp Access Tokens (link personalizado por assinante, expira em 12h) ─
export const whatsappAccessTokens = mysqlTable(
  "whatsapp_access_tokens",
  {
    id: int("id").autoincrement().primaryKey(),
    token: varchar("token", { length: 128 }).notNull().unique(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expiresAt").notNull(),
    usedAt: timestamp("usedAt"),                    // null = not yet used
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [
    index("idx_wat_token").on(t.token),
    index("idx_wat_userId").on(t.userId),
    index("idx_wat_expiresAt").on(t.expiresAt),
  ]
);
export type WhatsappAccessToken = typeof whatsappAccessTokens.$inferSelect;
export type InsertWhatsappAccessToken = typeof whatsappAccessTokens.$inferInsert;

// ─── Email Daily Sends (guard persistido para evitar envio duplo de e-mail) ───
// Registra cada envio do briefing diário por e-mail. Guard verifica esta tabela
// em vez de variável em memória, que é perdida ao reiniciar o servidor.
export const emailDailySends = mysqlTable(
  "email_daily_sends",
  {
    id: int("id").autoincrement().primaryKey(),
    sendDate: date("sendDate").notNull().unique(),  // Data BRT do envio (YYYY-MM-DD)
    sentAt: timestamp("sentAt").notNull(),          // Timestamp exato do envio
    subscriberCount: int("subscriberCount").default(0).notNull(),
    status: mysqlEnum("status", ["sent", "failed"]).default("sent").notNull(),
    errorMessage: text("errorMessage"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [
    index("idx_email_daily_sends_sendDate").on(t.sendDate),
  ]
);
export type EmailDailySend = typeof emailDailySends.$inferSelect;
export type InsertEmailDailySend = typeof emailDailySends.$inferInsert;

// ─── System Settings ────────────────────────────────────────────────────────
// Key-value store for admin-configurable settings (e.g., corporate email, sender name)
export const systemSettings = mysqlTable("system_settings", {
  key: varchar("key", { length: 128 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type SystemSetting = typeof systemSettings.$inferSelect;

// ─── Subscription helper types ────────────────────────────────────────────────
export type SubscriptionPlan = "morning_call" | "corporativo" | "agro_publisher";

// Plan hierarchy: morning_call < corporativo < agro_publisher
export const PLAN_ORDER: SubscriptionPlan[] = ["morning_call", "corporativo", "agro_publisher"];

export function hasActiveSub(user: User | null | undefined): boolean {
  if (!user) return false;
  return user.subscriptionStatus === "active" || user.subscriptionStatus === "trialing";
}

export function hasPlan(user: User | null | undefined, minPlan: SubscriptionPlan): boolean {
  if (!user) return false;
  // Admin always has full access (top plan)
  if (user.role === "admin") return true;
  if (!hasActiveSub(user)) return false;
  const userIdx = PLAN_ORDER.indexOf(user.subscriptionPlan as SubscriptionPlan);
  const minIdx = PLAN_ORDER.indexOf(minPlan);
  if (userIdx === -1) return false;
  return userIdx >= minIdx;
}

export function isPublisher(user: User | null | undefined): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  return hasActiveSub(user) && user.subscriptionPlan === "agro_publisher";
}
