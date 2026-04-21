/**
 * WhatsAppAccess.tsx
 *
 * Landing page for the personalized WhatsApp Morning Call link.
 * URL: /acesso?token=<hex_token>
 *
 * Flow:
 * 1. Extract token from URL query string
 * 2. Call whatsapp.validateToken mutation (consumes the token)
 * 3a. Token valid + subscriber → show Dashboard with full sidebar
 * 3b. Token valid + NOT subscriber → redirect to /pricing
 * 3c. Token invalid/expired/used → show "link expired" message with pricing CTA
 * 3d. No token → redirect to /pricing
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Loader2, AlertCircle, CheckCircle2, Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type AccessState =
  | "loading"
  | "valid_subscriber"
  | "valid_not_subscriber"
  | "invalid"
  | "no_token";

export default function WhatsAppAccess() {
  const [, setLocation] = useLocation();
  const [state, setState] = useState<AccessState>("loading");
  const [reason, setReason] = useState<string>("");

  const validateToken = trpc.whatsapp.validateToken.useMutation();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) {
      setState("no_token");
      return;
    }

    validateToken.mutate(
      { token },
      {
        onSuccess: (data) => {
          if (!data.valid) {
            const msgs: Record<string, string> = {
              not_found: "Link não encontrado.",
              expired: "Este link expirou (válido por 12 horas).",
              already_used: "Este link já foi utilizado. Cada link é de uso único.",
            };
            setReason(msgs[data.reason ?? "not_found"] ?? "Link inválido.");
            setState("invalid");
            return;
          }

          if (data.isSubscriber) {
            // Subscriber: redirect to dashboard after a brief welcome
            setState("valid_subscriber");
            setTimeout(() => setLocation("/"), 1500);
          } else {
            // Not a subscriber: redirect to pricing
            setState("valid_not_subscriber");
            setTimeout(() => setLocation("/pricing"), 1500);
          }
        },
        onError: () => {
          setReason("Erro ao validar o link. Tente novamente.");
          setState("invalid");
        },
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <Leaf className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <p className="font-bold text-lg leading-none">AgroRSS</p>
            <p className="text-xs text-muted-foreground">Morning Call</p>
          </div>
        </div>

        <Card className="border-border/50 shadow-lg">
          <CardContent className="pt-8 pb-8 text-center">
            {state === "loading" && (
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-muted-foreground">Validando seu acesso...</p>
              </div>
            )}

            {state === "valid_subscriber" && (
              <div className="flex flex-col items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                  <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-xl font-semibold">Acesso confirmado!</p>
                  <p className="text-muted-foreground mt-1">
                    Redirecionando para o painel...
                  </p>
                </div>
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            )}

            {state === "valid_not_subscriber" && (
              <div className="flex flex-col items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                  <Leaf className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-xl font-semibold">Conheça o AgroRSS</p>
                  <p className="text-muted-foreground mt-1">
                    Você recebeu este Morning Call como prévia. Assine para ter acesso completo ao painel.
                  </p>
                </div>
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Abrindo página de planos...</p>
              </div>
            )}

            {state === "invalid" && (
              <div className="flex flex-col items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                  <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-xl font-semibold">Link inválido</p>
                  <p className="text-muted-foreground mt-1">{reason}</p>
                </div>
                <div className="flex flex-col gap-2 w-full mt-2">
                  <Button
                    onClick={() => setLocation("/pricing")}
                    className="w-full"
                  >
                    Ver planos de assinatura
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setLocation("/")}
                    className="w-full"
                  >
                    Ir para o painel
                  </Button>
                </div>
              </div>
            )}

            {state === "no_token" && (
              <div className="flex flex-col items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <Leaf className="h-8 w-8 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xl font-semibold">AgroRSS Morning Call</p>
                  <p className="text-muted-foreground mt-1">
                    Inteligência do agronegócio direto no seu WhatsApp, todos os dias às 06h.
                  </p>
                </div>
                <Button
                  onClick={() => setLocation("/pricing")}
                  className="w-full mt-2"
                >
                  Assinar agora
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Thiago Lucena | Análise Estratégica Agronegócio
        </p>
      </div>
    </div>
  );
}
