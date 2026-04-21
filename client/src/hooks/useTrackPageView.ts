import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

const PAGE_LABELS: Record<string, string> = {
  "/": "Dashboard",
  "/articles": "Artigos",
  "/summary": "Resumo IA",
  "/aprovacao": "Esteira de Conteúdo",
  "/commodities": "Cotações",
  "/conversao": "Conversão",
  "/feeds": "Feeds RSS",
  "/jobs": "Status do Sistema",
  "/whatsapp-admin": "WhatsApp Admin",
  "/admin/comercial": "Painel Comercial",
  "/pricing": "Planos",
  "/perfil": "Meu Perfil",
  "/subscription/success": "Confirmação de Assinatura",
};

/**
 * Hook that automatically tracks page views for the commercial dashboard.
 * Call this once inside DashboardLayout or a top-level component.
 */
export function useTrackPageView() {
  const [location] = useLocation();
  const { user } = useAuth();
  const trackEvent = trpc.commercial.trackEvent.useMutation();
  const lastTracked = useRef<string>("");

  useEffect(() => {
    // Only track for authenticated users, and avoid duplicate tracking
    if (!user || lastTracked.current === location) return;
    lastTracked.current = location;

    const feature = PAGE_LABELS[location] ?? location;

    trackEvent.mutate({
      eventType: "page_view",
      page: location,
      feature,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, user?.id]);
}
