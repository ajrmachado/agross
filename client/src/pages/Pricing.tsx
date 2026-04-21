import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Loader2, Sparkles, ExternalLink, ShieldCheck, Zap, Building2, Star, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";

const PLAN_ICONS: Record<string, React.ReactNode> = {
  morning_call:  <Zap className="w-5 h-5" />,
  corporativo:   <Building2 className="w-5 h-5" />,
  agro_publisher: <Megaphone className="w-5 h-5" />,
};

// Card style per plan
const PLAN_STYLE: Record<string, { card: string; badge: string; btn: string; check: string; icon: string }> = {
  morning_call: {
    card:  "border border-border bg-card",
    badge: "",
    btn:   "outline",
    check: "text-green-500",
    icon:  "bg-muted text-muted-foreground",
  },
  corporativo: {
    card:  "border-2 border-primary bg-primary/5 ring-2 ring-primary/20 shadow-lg",
    badge: "bg-primary text-primary-foreground",
    btn:   "default",
    check: "text-primary",
    icon:  "bg-primary text-primary-foreground",
  },
  agro_publisher: {
    card:  "border-2 border-purple-500 bg-purple-50/50 ring-2 ring-purple-200 shadow-lg dark:bg-purple-950/20 dark:border-purple-400 dark:ring-purple-800",
    badge: "bg-purple-600 text-white",
    btn:   "purple",
    check: "text-purple-600",
    icon:  "bg-purple-600 text-white",
  },
};

export default function Pricing() {
  const { isAuthenticated } = useAuth();
  const { active, plan: currentPlan, isLoading: subLoading } = useSubscription();
  const { data: plans, isLoading: plansLoading } = trpc.subscription.plans.useQuery();
  const createCheckout = trpc.subscription.createCheckout.useMutation();
  const createPortal = trpc.subscription.createPortal.useMutation();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  async function handleSubscribe(planId: string) {
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }
    setLoadingPlan(planId);
    try {
      const { url } = await createCheckout.mutateAsync({
        planId: planId as any,
        origin: window.location.origin,
      });
      toast.info("Redirecionando para o checkout...");
      window.open(url, "_blank");
    } catch (err: any) {
      toast.error("Erro ao iniciar checkout: " + (err.message ?? "Tente novamente."));
    } finally {
      setLoadingPlan(null);
    }
  }

  async function handleManage() {
    try {
      const { url } = await createPortal.mutateAsync({ origin: window.location.origin });
      toast.info("Abrindo portal de gerenciamento...");
      window.open(url, "_blank");
    } catch (err: any) {
      toast.error("Erro ao abrir portal: " + (err.message ?? "Tente novamente."));
    }
  }

  if (plansLoading || subLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 bg-green-100 text-green-800 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
          <Sparkles className="h-4 w-4" />
          Inteligência do Agronegócio
        </div>
        <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Escolha seu plano
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Do briefing diário à produção de conteúdo — inteligência artificial a serviço do agronegócio brasileiro.
        </p>
      </div>

      {/* Active subscription banner */}
      {active && currentPlan && (
        <div className="mb-8 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center justify-between gap-4 dark:bg-green-950/30 dark:border-green-800">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-green-600 shrink-0" />
            <div>
              <p className="font-semibold text-green-900 dark:text-green-200">
                Assinatura ativa — {plans?.find(p => p.id === currentPlan)?.name ?? currentPlan}
              </p>
              <p className="text-sm text-green-700 dark:text-green-400">Gerencie sua assinatura, histórico de pagamentos e dados de cobrança.</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleManage}
            disabled={createPortal.isPending}
            className="border-green-400 text-green-700 hover:bg-green-100 shrink-0"
          >
            {createPortal.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4 mr-1" />}
            Gerenciar
          </Button>
        </div>
      )}

      {/* Plans grid — 3 columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {plans?.map((plan) => {
          const isCurrentPlan = active && currentPlan === plan.id;
          const isLoading = loadingPlan === plan.id;
          const style = PLAN_STYLE[plan.id] ?? PLAN_STYLE.morning_call;
          const icon = PLAN_ICONS[plan.id];
          const isPublisher = plan.id === "agro_publisher";

          return (
            <div key={plan.id} className={`relative flex flex-col rounded-2xl transition-all duration-200 p-6 ${style.card}`}>
              {/* Badge */}
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className={`inline-flex items-center gap-1 px-4 py-1 rounded-full text-xs font-semibold shadow ${style.badge}`}>
                    <Star className="w-3 h-3" />
                    {plan.badge}
                  </span>
                </div>
              )}

              {/* Icon + name */}
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${style.icon}`}>
                  {icon}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground leading-tight">{plan.name}</h2>
                  {isCurrentPlan && (
                    <Badge variant="outline" className="text-xs mt-0.5">Plano atual</Badge>
                  )}
                </div>
              </div>

              {/* Price */}
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-4xl font-bold text-foreground">R$ {plan.priceMonthly}</span>
                <span className="text-muted-foreground text-sm">/mês</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">7 dias grátis · Cancele quando quiser</p>
              <p className="text-sm text-muted-foreground mb-5 leading-relaxed">{plan.description}</p>

              {/* Features */}
              <ul className="space-y-2 flex-1 mb-6">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-foreground">
                    <Check className={`h-4 w-4 mt-0.5 shrink-0 ${style.check}`} />
                    {feature}
                  </li>
                ))}
                {(plan as any).notIncluded?.map((item: string, i: number) => (
                  <li key={`ni-${i}`} className="flex items-start gap-2.5 text-sm text-muted-foreground opacity-40">
                    <X className="h-4 w-4 mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              {isCurrentPlan ? (
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={handleManage}
                  disabled={createPortal.isPending}
                >
                  {createPortal.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ExternalLink className="h-4 w-4 mr-2" />}
                  Gerenciar assinatura
                </Button>
              ) : (
                <Button
                  className={`w-full ${isPublisher ? "bg-purple-600 hover:bg-purple-700 text-white border-0" : ""}`}
                  variant={plan.id === "corporativo" ? "default" : (isPublisher ? "default" : "outline")}
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={isLoading || createCheckout.isPending}
                >
                  {isLoading ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" />Aguarde...</>
                  ) : (
                    "Começar 7 dias grátis"
                  )}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* Test card notice */}
      <div className="text-center p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 mb-10">
        <p className="font-medium mb-1">Ambiente de testes — nenhum valor real é cobrado</p>
        <p>Use o cartão <code className="bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded text-xs font-mono">4242 4242 4242 4242</code> com qualquer data futura e CVV para testar o checkout.</p>
      </div>

      {/* FAQ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {[
          {
            q: "Posso cancelar a qualquer momento?",
            a: "Sim. Você pode cancelar pelo portal do cliente sem multas ou taxas adicionais. O acesso continua até o fim do período pago.",
          },
          {
            q: "O que é a Esteira de Conteúdo?",
            a: "Exclusivo do plano Agro Publisher: a IA gera um post LinkedIn, uma imagem profissional e um texto para WhatsApp prontos para publicar — baseados no briefing do dia.",
          },
          {
            q: "O plano Corporativo inclui múltiplos acessos?",
            a: "Sim. O plano Corporativo permite até 10 usuários na mesma conta, ideal para equipes de trading, cooperativas e consultorias.",
          },
          {
            q: "Como funciona o WhatsApp Morning Call?",
            a: "Todos os dias às 06h (horário de Brasília) você recebe no WhatsApp um briefing do agronegócio com cotações internacionais, análise de mercado e perspectivas do dia.",
          },
        ].map((item, i) => (
          <div key={i} className="p-5 bg-white dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700 rounded-xl">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">{item.q}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{item.a}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
