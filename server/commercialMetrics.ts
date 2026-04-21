/**
 * Commercial Metrics — Admin-only queries for the Commercial Dashboard
 * Provides MRR, ARR, user stats, subscription breakdown, organizations, and usage data.
 */

import { getDb } from "./db";
import { users, organizations, organizationMembers, usageEvents, whatsappAutoSends } from "../drizzle/schema";
import { eq, sql, desc, gte, and, count, isNotNull } from "drizzle-orm";

// Plan pricing in BRL
const PLAN_PRICES: Record<string, number> = {
  morning_call: 97,
  corporativo: 497,
};

export interface CommercialOverview {
  totalUsers: number;
  totalOrgs: number;
  activeSubscriptions: number;
  trialSubscriptions: number;
  canceledSubscriptions: number;
  pastDueSubscriptions: number;
  mrr: number;        // Monthly Recurring Revenue in BRL
  arrEstimated: number; // ARR = MRR * 12
  newUsersLast30Days: number;
  newUsersLast7Days: number;
}

export interface SubscriptionGroup {
  plan: string;
  status: string;
  count: number;
  mrr: number;
}

export interface UserRow {
  id: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  plan: string | null;
  status: string | null;
  createdAt: Date;
  lastSignedIn: Date;
  whatsappOptIn: boolean;
}

export interface OrgRow {
  id: number;
  name: string;
  ownerName: string | null;
  ownerEmail: string | null;
  plan: string;
  memberCount: number;
  maxUsers: number;
  active: boolean;
  createdAt: Date;
}

export interface MrrDataPoint {
  month: string; // YYYY-MM
  mrr: number;
  userCount: number;
}

export interface HourlyUsage {
  hour: number; // 0-23 BRT
  count: number;
}

export interface TopFeature {
  feature: string;
  count: number;
}

export interface TopPage {
  page: string;
  count: number;
}

export async function getCommercialOverview(): Promise<CommercialOverview> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // All users
  const [totalResult] = await db.select({ count: count() }).from(users);
  const totalUsers = totalResult.count;

  // Subscription breakdown
  const subGroups = await db
    .select({
      status: users.subscriptionStatus,
      plan: users.subscriptionPlan,
      count: count(),
    })
    .from(users)
    .where(isNotNull(users.subscriptionStatus))
    .groupBy(users.subscriptionStatus, users.subscriptionPlan);

  let activeSubscriptions = 0;
  let trialSubscriptions = 0;
  let canceledSubscriptions = 0;
  let pastDueSubscriptions = 0;
  let mrr = 0;

  for (const g of subGroups) {
    const price = PLAN_PRICES[g.plan ?? ""] ?? 0;
    if (g.status === "active") {
      activeSubscriptions += g.count;
      mrr += price * g.count;
    } else if (g.status === "trialing") {
      trialSubscriptions += g.count;
      // Trialing users are expected to convert — include in MRR estimate
      mrr += price * g.count;
    } else if (g.status === "canceled") {
      canceledSubscriptions += g.count;
    } else if (g.status === "past_due") {
      pastDueSubscriptions += g.count;
    }
  }

  // Organizations
  const [orgResult] = await db.select({ count: count() }).from(organizations).where(eq(organizations.active, true));
  const totalOrgs = orgResult.count;

  // New users
  const [newLast30] = await db
    .select({ count: count() })
    .from(users)
    .where(gte(users.createdAt, thirtyDaysAgo));
  const [newLast7] = await db
    .select({ count: count() })
    .from(users)
    .where(gte(users.createdAt, sevenDaysAgo));

  return {
    totalUsers,
    totalOrgs,
    activeSubscriptions,
    trialSubscriptions,
    canceledSubscriptions,
    pastDueSubscriptions,
    mrr,
    arrEstimated: mrr * 12,
    newUsersLast30Days: newLast30.count,
    newUsersLast7Days: newLast7.count,
  };
}

export async function getSubscriptionGroups(): Promise<SubscriptionGroup[]> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const rows = await db
    .select({
      plan: users.subscriptionPlan,
      status: users.subscriptionStatus,
      count: count(),
    })
    .from(users)
    .where(isNotNull(users.subscriptionStatus))
    .groupBy(users.subscriptionPlan, users.subscriptionStatus)
    .orderBy(desc(count()));

  return rows.map((r) => ({
    plan: r.plan ?? "sem plano",
    status: r.status ?? "sem status",
    count: r.count,
    mrr: (PLAN_PRICES[r.plan ?? ""] ?? 0) * (r.status === "active" || r.status === "trialing" ? r.count : 0),
  }));
}

export async function getAllUsers(limit = 100): Promise<UserRow[]> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      plan: users.subscriptionPlan,
      status: users.subscriptionStatus,
      createdAt: users.createdAt,
      lastSignedIn: users.lastSignedIn,
      whatsappOptIn: users.whatsappOptIn,
    })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(limit);

  return rows;
}

export async function getAllOrgs(): Promise<OrgRow[]> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const rows = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      ownerName: users.name,
      ownerEmail: users.email,
      plan: organizations.plan,
      maxUsers: organizations.maxUsers,
      active: organizations.active,
      createdAt: organizations.createdAt,
    })
    .from(organizations)
    .leftJoin(users, eq(organizations.ownerId, users.id))
    .orderBy(desc(organizations.createdAt));

  // Get member counts
  const memberCounts = await db
    .select({
      orgId: organizationMembers.orgId,
      count: count(),
    })
    .from(organizationMembers)
    .groupBy(organizationMembers.orgId);

  const countMap = new Map(memberCounts.map((m) => [m.orgId, m.count]));

  return rows.map((r) => ({
    ...r,
    memberCount: countMap.get(r.id) ?? 0,
  }));
}

export async function getMrrHistory(months = 6): Promise<MrrDataPoint[]> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  // Get users created by month with their plan
  const rows = await db.execute(sql`
    SELECT 
      DATE_FORMAT(createdAt, '%Y-%m') as month,
      subscriptionPlan as plan,
      subscriptionStatus as status,
      COUNT(*) as cnt
    FROM users
    WHERE subscriptionPlan IS NOT NULL
      AND createdAt >= DATE_SUB(NOW(), INTERVAL ${months} MONTH)
    GROUP BY DATE_FORMAT(createdAt, '%Y-%m'), subscriptionPlan, subscriptionStatus
    ORDER BY month ASC
  `);

  // Build monthly MRR accumulation
  const monthMap = new Map<string, { mrr: number; userCount: number }>();

  for (const row of (rows[0] as unknown) as Array<{ month: string; plan: string; status: string; cnt: number }>) {
    const price = PLAN_PRICES[row.plan] ?? 0;
    const isRevenue = row.status === "active" || row.status === "trialing";
    if (!monthMap.has(row.month)) {
      monthMap.set(row.month, { mrr: 0, userCount: 0 });
    }
    const entry = monthMap.get(row.month)!;
    entry.userCount += Number(row.cnt);
    if (isRevenue) entry.mrr += price * Number(row.cnt);
  }

  return Array.from(monthMap.entries()).map(([month, data]) => ({
    month,
    mrr: data.mrr,
    userCount: data.userCount,
  }));
}

export async function getHourlyUsage(days = 7): Promise<HourlyUsage[]> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Use login events (lastSignedIn) as proxy for access hours
  const rows = await db.execute(sql`
    SELECT 
      MOD(HOUR(lastSignedIn) - 3 + 24, 24) as brt_hour,
      COUNT(*) as cnt
    FROM users
    WHERE lastSignedIn >= ${since}
    GROUP BY brt_hour
    ORDER BY brt_hour ASC
  `);

  const hourMap = new Map<number, number>();
  for (const row of (rows[0] as unknown) as Array<{ brt_hour: number; cnt: number }>) {
    hourMap.set(Number(row.brt_hour), Number(row.cnt));
  }

  return Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    count: hourMap.get(h) ?? 0,
  }));
}

export async function getTopFeatures(days = 30): Promise<TopFeature[]> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      feature: usageEvents.feature,
      count: count(),
    })
    .from(usageEvents)
    .where(and(isNotNull(usageEvents.feature), gte(usageEvents.createdAt, since)))
    .groupBy(usageEvents.feature)
    .orderBy(desc(count()))
    .limit(10);

  return rows.map((r) => ({ feature: r.feature ?? "unknown", count: r.count }));
}

export async function getTopPages(days = 30): Promise<TopPage[]> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      page: usageEvents.page,
      count: count(),
    })
    .from(usageEvents)
    .where(and(isNotNull(usageEvents.page), gte(usageEvents.createdAt, since)))
    .groupBy(usageEvents.page)
    .orderBy(desc(count()))
    .limit(10);

  return rows.map((r) => ({ page: r.page ?? "unknown", count: r.count }));
}

export async function trackUsageEvent(
  userId: number | null,
  eventType: string,
  page?: string,
  feature?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    await db.insert(usageEvents).values({
      userId: userId ?? undefined,
      eventType,
      page: page ?? undefined,
      feature: feature ?? undefined,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
    });
  } catch {
    // Non-critical — don't throw
  }
}
