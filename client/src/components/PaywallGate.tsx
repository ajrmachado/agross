import { ReactNode } from "react";
import { Link } from "wouter";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription, type SubscriptionPlan } from "@/hooks/useSubscription";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Loader2 } from "lucide-react";

interface PaywallGateProps {
  /** Minimum plan required to see the content */
  minPlan: SubscriptionPlan;
  /** Feature name shown in the locked state */
  featureName: string;
  /** Short description shown in the locked state */
  description?: string;
  children: ReactNode;
}

const PLAN_LABELS: Record<SubscriptionPlan, string> = {
  morning_call: "Morning Call Agro (R$ 97/mês)",
  corporativo: "Corporativo (R$ 297/mês)",
  agro_publisher: "Agro Publisher (R$ 497/mês)",
};

const PLAN_COLORS: Record<SubscriptionPlan, { bg: string; border: string; text: string; icon: string }> = {
  morning_call: { bg: "bg-green-50", border: "border-green-200", text: "text-green-800", icon: "text-green-600" },
  corporativo:  { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-800", icon: "text-amber-600" },
  agro_publisher: { bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-800", icon: "text-purple-600" },
};

export function PaywallGate({ minPlan, featureName, description, children }: PaywallGateProps) {
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const { hasPlan, isLoading: subLoading } = useSubscription();

  if (authLoading || subLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    );
  }

  // Admin always has full access
  if (user?.role === "admin") {
    return <>{children}</>;
  }

  if (hasPlan(minPlan)) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      {/* Blurred preview */}
      <div className="pointer-events-none select-none blur-sm opacity-40 max-h-72 overflow-hidden">
        {children}
      </div>

      {/* Lock overlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-white/95 border border-gray-200 rounded-2xl shadow-xl p-8 max-w-sm w-full mx-4 text-center">
          <div className="flex justify-center mb-4">
            <div className={`h-14 w-14 rounded-full ${PLAN_COLORS[minPlan].bg} flex items-center justify-center`}>
              <Lock className={`h-7 w-7 ${PLAN_COLORS[minPlan].icon}`} />
            </div>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">{featureName}</h3>
          {description && (
            <p className="text-sm text-gray-600 mb-4">{description}</p>
          )}
          <div className={`flex items-center gap-2 ${PLAN_COLORS[minPlan].bg} ${PLAN_COLORS[minPlan].border} border rounded-lg px-3 py-2 mb-5 justify-center`}>
            <Sparkles className={`h-4 w-4 ${PLAN_COLORS[minPlan].icon} flex-shrink-0`} />
            <span className={`text-xs ${PLAN_COLORS[minPlan].text} font-medium`}>
              Disponível no plano {PLAN_LABELS[minPlan]}
            </span>
          </div>
          {isAuthenticated ? (
            <Link href="/pricing">
              <Button className="w-full bg-green-600 hover:bg-green-700 text-white">
                Ver planos e assinar
              </Button>
            </Link>
          ) : (
            <div className="space-y-2">
              <Button
                className="w-full bg-green-600 hover:bg-green-700 text-white"
                onClick={() => { window.location.href = getLoginUrl(); }}
              >
                Entrar para assinar
              </Button>
              <Link href="/pricing">
                <Button variant="ghost" className="w-full text-sm text-gray-500">
                  Ver planos
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
