import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { stripe, getOrCreateStripePrices, getPlanById, getPlanByPriceId, PLANS, type PlanId } from "./stripe-products";
import type { User } from "../drizzle/schema";

// ─── DB helpers ───────────────────────────────────────────────────────────────

export async function updateUserSubscription(
  userId: number,
  data: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string | null;
    subscriptionPlan?: PlanId | null;
    subscriptionStatus?: string | null;
    subscriptionEndsAt?: Date | null;
  }
) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set(data as any).where(eq(users.id, userId));
}

export async function getUserByStripeCustomerId(customerId: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.stripeCustomerId, customerId)).limit(1);
  return result[0];
}

export async function getUserById(userId: number): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result[0];
}

// ─── Stripe helpers ───────────────────────────────────────────────────────────

export async function getOrCreateStripeCustomer(user: User): Promise<string> {
  if (user.stripeCustomerId) return user.stripeCustomerId;

  const customer = await stripe.customers.create({
    email: user.email ?? undefined,
    name: user.name ?? undefined,
    metadata: { user_id: user.id.toString(), open_id: user.openId },
  });

  await updateUserSubscription(user.id, { stripeCustomerId: customer.id });
  return customer.id;
}

export async function createCheckoutSession(user: User, planId: PlanId, origin: string): Promise<string> {
  const priceIds = await getOrCreateStripePrices();
  const priceId = priceIds[planId];
  const customerId = await getOrCreateStripeCustomer(user);
  const plan = getPlanById(planId);

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: plan?.trialDays ? { trial_period_days: plan.trialDays } : undefined,
    allow_promotion_codes: true,
    success_url: `${origin}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/pricing`,
    client_reference_id: user.id.toString(),
    metadata: {
      user_id: user.id.toString(),
      plan_id: planId,
      customer_email: user.email ?? "",
      customer_name: user.name ?? "",
    },
  });

  return session.url!;
}

export async function createPortalSession(user: User, origin: string): Promise<string> {
  const customerId = await getOrCreateStripeCustomer(user);

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${origin}/dashboard`,
  });

  return session.url;
}

// ─── Webhook event handlers ───────────────────────────────────────────────────

export async function handleCheckoutCompleted(session: any) {
  const userId = parseInt(session.metadata?.user_id ?? session.client_reference_id ?? "0");
  const planId = session.metadata?.plan_id as PlanId | undefined;
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  if (!userId || !planId || !subscriptionId) {
    console.warn("[Webhook] checkout.session.completed missing required fields", { userId, planId, subscriptionId });
    return;
  }

  // Fetch subscription to get status and period
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const status = sub.status;
  const subAny = sub as any;
  const endsAt = subAny.current_period_end ? new Date(subAny.current_period_end * 1000) : null;

  await updateUserSubscription(userId, {
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    subscriptionPlan: planId,
    subscriptionStatus: status,
    subscriptionEndsAt: endsAt,
  });

  console.log(`[Webhook] Subscription activated: user=${userId} plan=${planId} status=${status}`);
}

export async function handleSubscriptionUpdated(subscription: any) {
  const customerId = subscription.customer as string;
  const user = await getUserByStripeCustomerId(customerId);
  if (!user) {
    console.warn("[Webhook] subscription.updated: user not found for customer", customerId);
    return;
  }

  const status = subscription.status as string;
  const endsAt = subscription.current_period_end
    ? new Date((subscription.current_period_end as number) * 1000)
    : null;

  // Determine plan from price ID
  let planId: PlanId | null = user.subscriptionPlan as PlanId | null;
  const items = subscription.items?.data ?? [];
  if (items.length > 0) {
    const priceId = items[0].price?.id;
    const plan = getPlanByPriceId(priceId);
    if (plan) planId = plan.id;
  }

  await updateUserSubscription(user.id, {
    stripeSubscriptionId: subscription.id,
    subscriptionPlan: planId,
    subscriptionStatus: status,
    subscriptionEndsAt: endsAt,
  });

  console.log(`[Webhook] Subscription updated: user=${user.id} plan=${planId} status=${status}`);
}

export async function handleSubscriptionDeleted(subscription: any) {
  const customerId = subscription.customer as string;
  const user = await getUserByStripeCustomerId(customerId);
  if (!user) return;

  await updateUserSubscription(user.id, {
    stripeSubscriptionId: null,
    subscriptionPlan: null,
    subscriptionStatus: "canceled",
    subscriptionEndsAt: null,
  });

  console.log(`[Webhook] Subscription canceled: user=${user.id}`);
}

// ─── Subscription status helper ───────────────────────────────────────────────

export function getSubscriptionInfo(user: User | null | undefined) {
  if (!user) return { active: false, plan: null, status: null, endsAt: null };

  // Admin always has full access regardless of subscription status
  if (user.role === "admin") {
    return {
      active: true,
      plan: user.subscriptionPlan ?? "corporativo",
      status: user.subscriptionStatus ?? "active",
      endsAt: user.subscriptionEndsAt ?? null,
      planDetails: PLANS.find((p) => p.id === "corporativo") ?? null,
    };
  }

  const active =
    user.subscriptionStatus === "active" || user.subscriptionStatus === "trialing";

  return {
    active,
    plan: user.subscriptionPlan ?? null,
    status: user.subscriptionStatus ?? null,
    endsAt: user.subscriptionEndsAt ?? null,
    planDetails: active ? PLANS.find((p) => p.id === user.subscriptionPlan) ?? null : null,
  };
}
