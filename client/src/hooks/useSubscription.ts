import { trpc } from "@/lib/trpc";

export type SubscriptionPlan = "morning_call" | "corporativo" | "agro_publisher";

// Hierarchy: morning_call < corporativo < agro_publisher
const PLAN_ORDER: SubscriptionPlan[] = ["morning_call", "corporativo", "agro_publisher"];

export function useSubscription() {
  const { data, isLoading, refetch } = trpc.subscription.status.useQuery();

  const active = data?.active ?? false;
  const plan = (data?.plan ?? null) as SubscriptionPlan | null;

  function hasPlan(minPlan: SubscriptionPlan): boolean {
    if (!active || !plan) return false;
    const userIdx = PLAN_ORDER.indexOf(plan);
    const minIdx = PLAN_ORDER.indexOf(minPlan);
    if (userIdx === -1) return false;
    return userIdx >= minIdx;
  }

  function isPublisher(): boolean {
    return active && plan === "agro_publisher";
  }

  return {
    isLoading,
    active,
    plan,
    status: data?.status ?? null,
    endsAt: data?.endsAt ?? null,
    planDetails: data?.planDetails ?? null,
    hasPlan,
    isPublisher,
    refetch,
  };
}
