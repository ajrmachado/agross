import { useEffect } from "react";
import { Link } from "wouter";
import { CheckCircle2, ArrowRight, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

export default function SubscriptionSuccess() {
  const utils = trpc.useUtils();
  const { user, isAuthenticated } = useAuth();

  // Invalidate subscription status so the new plan is reflected immediately
  useEffect(() => {
    utils.subscription.status.invalidate();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-50 px-4">
      <div className="max-w-md w-full text-center">
        <div className="flex justify-center mb-6">
          <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center shadow-lg">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Assinatura ativada!</h1>
        <p className="text-gray-600 mb-2">
          {user?.name ? `Bem-vindo, ${user.name.split(" ")[0]}!` : "Bem-vindo ao AgroRSS!"}
        </p>
        <p className="text-gray-500 text-sm mb-8">
          Sua assinatura foi confirmada. Agora você tem acesso ao painel de
          inteligência do agronegócio — briefings diários, cotações e resumos com IA.
        </p>
        <div className="space-y-3">
          {isAuthenticated ? (
            <>
              <Link href="/">
                <Button className="w-full bg-green-600 hover:bg-green-700 text-white shadow">
                  Ir para o painel
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
              <Link href="/summary">
                <Button variant="outline" className="w-full bg-white">
                  Ver resumo de hoje com IA
                </Button>
              </Link>
            </>
          ) : (
            <>
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-2">
                Faça login para acessar o painel com sua nova assinatura.
              </p>
              <Button
                className="w-full bg-green-600 hover:bg-green-700 text-white shadow"
                onClick={() => { window.location.href = getLoginUrl(); }}
              >
                <LogIn className="h-4 w-4 mr-2" />
                Entrar no painel
              </Button>
              <Link href="/pricing">
                <Button variant="outline" className="w-full bg-white">
                  Ver planos
                </Button>
              </Link>
            </>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-6">
          Em caso de dúvidas, acesse a aba Planos dentro do painel.
        </p>
      </div>
    </div>
  );
}
