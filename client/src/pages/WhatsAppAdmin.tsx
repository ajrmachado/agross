import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  MessageCircle,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Smartphone,
  History,
  Eye,
} from "lucide-react";

// WhatsApp-style text renderer: **bold** → <strong>, _italic_ → <em>, newlines → <br>
function WhatsAppPreview({ text }: { text: string }) {
  const html = text
    .replace(/\*(.*?)\*/g, "<strong>$1</strong>")
    .replace(/_(.*?)_/g, "<em>$1</em>")
    .replace(/\n/g, "<br />");
  return (
    <div
      className="text-sm leading-relaxed font-sans whitespace-pre-wrap break-words"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function formatDateBR(val: Date | string | null | undefined): string {
  if (!val) return "—";
  const iso = val instanceof Date ? val.toISOString() : String(val);
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function formatDateTimeBR(val: Date | string | null | undefined): string {
  if (!val) return "—";
  const dt = val instanceof Date ? val : new Date(val);
  return dt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export default function WhatsAppAdmin() {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const {
    data: subscribers,
    isLoading: loadingSubscribers,
    refetch,
  } = trpc.whatsapp.subscribers.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const { data: autoHistory = [], refetch: refetchHistory, isLoading: loadingHistory } =
    trpc.whatsapp.autoHistory.useQuery(undefined, { refetchOnWindowFocus: false });

  const totalSubscribers = subscribers?.length ?? 0;
  const withPhone = subscribers?.filter((u) => u.phone).length ?? 0;
  const optedIn = subscribers?.filter((u) => u.whatsappOptIn && u.phone).length ?? 0;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageCircle className="h-6 w-6 text-green-600" />
            WhatsApp — Monitoramento Z-API
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Acompanhamento de assinantes e histórico de envios do Morning Call
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            refetch();
            refetchHistory();
          }}
        >
          <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Assinantes ativos</span>
            </div>
            <p className="text-2xl font-bold">{totalSubscribers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Smartphone className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Com telefone</span>
            </div>
            <p className="text-2xl font-bold">{withPhone}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Receberão hoje</span>
            </div>
            <p className="text-2xl font-bold">{optedIn}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-orange-500" />
              <span className="text-xs text-muted-foreground">Envio automático</span>
            </div>
            <p className="text-lg font-bold mt-0.5">06:00 BRT</p>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Subscriber list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lista de assinantes</CardTitle>
          <CardDescription>
            Usuários com assinatura ativa ou em período de teste
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingSubscribers ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : !subscribers || subscribers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>Nenhum assinante ativo ainda</p>
            </div>
          ) : (
            <div className="space-y-2">
              {subscribers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-sm font-medium text-green-700 shrink-0">
                      {(user.name ?? "?")[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{user.name ?? "Sem nome"}</p>
                      <p className="text-xs text-muted-foreground">{user.email ?? "Sem e-mail"}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {user.phone ? (
                      <span className="text-xs font-mono text-muted-foreground">+{user.phone}</span>
                    ) : (
                      <span className="text-xs text-orange-500 flex items-center gap-1">
                        <Smartphone className="h-3 w-3" /> Sem telefone
                      </span>
                    )}

                    {user.phone && user.whatsappOptIn ? (
                      <Badge
                        variant="outline"
                        className="text-green-600 border-green-300 bg-green-50 text-xs"
                      >
                        <CheckCircle className="h-3 w-3 mr-1" /> WhatsApp ativo
                      </Badge>
                    ) : user.phone && !user.whatsappOptIn ? (
                      <Badge variant="outline" className="text-gray-500 border-gray-300 text-xs">
                        <XCircle className="h-3 w-3 mr-1" /> Opt-out
                      </Badge>
                    ) : null}

                    <Badge variant="outline" className="text-xs capitalize">
                      {user.subscriptionPlan ?? "—"}
                    </Badge>

                    {user.subscriptionStatus === "trialing" && (
                      <Badge
                        variant="outline"
                        className="text-orange-600 border-orange-300 text-xs"
                      >
                        Teste
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Auto-send history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4 text-blue-500" />
            Histórico de envios automáticos
          </CardTitle>
          <CardDescription>
            Registro de todos os Morning Calls enviados automaticamente às 06:00 BRT — inclui o texto completo enviado
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingHistory ? (
            <div className="text-center py-6 text-muted-foreground text-sm">Carregando...</div>
          ) : autoHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum envio automático registrado ainda.</p>
              <p className="text-xs mt-1">O primeiro ocorrerá amanhã às 06:00 BRT.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {autoHistory.map((record: any) => (
                <div key={record.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      {record.status === "sent" ? (
                        <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
                      ) : record.status === "failed" ? (
                        <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                      ) : (
                        <Clock className="h-5 w-5 text-amber-500 shrink-0" />
                      )}
                      <div>
                        <div className="font-semibold">{formatDateBR(record.sendDate)}</div>
                        <div className="text-xs text-muted-foreground">
                          {record.sentAt ? `Enviado às ${formatDateTimeBR(record.sentAt)}` : "Pendente"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {record.status === "sent" && (
                        <>
                          <Badge variant="outline" className="text-green-600 border-green-300">
                            ✓ {record.totalSent} enviados
                          </Badge>
                          {record.totalFailed > 0 && (
                            <Badge variant="outline" className="text-red-500 border-red-300">
                              ✗ {record.totalFailed} falhas
                            </Badge>
                          )}
                        </>
                      )}
                      {record.status === "pending" && (
                        <Badge variant="outline" className="text-amber-600 border-amber-300">Aguardando</Badge>
                      )}
                      {record.status === "failed" && (
                        <Badge variant="destructive">Falha</Badge>
                      )}
                      {record.sentText && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedId(expandedId === record.id ? null : record.id)}
                          title="Ver texto enviado"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {expandedId === record.id && record.sentText && (
                    <div className="mt-2 bg-[#dcf8c6] dark:bg-green-900/30 rounded-xl p-3 text-xs whitespace-pre-wrap leading-relaxed border border-green-200 dark:border-green-800">
                      <WhatsAppPreview text={record.sentText} />
                    </div>
                  )}
                  {expandedId === record.id && record.errorMessage && (
                    <div className="mt-2 text-xs text-red-500 bg-red-50 dark:bg-red-950 p-2 rounded">
                      Erro: {record.errorMessage}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Z-API connection info */}
      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
        <CardContent className="pt-4">
          <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-1">
            ℹ️ Conexão Z-API
          </h3>
          <p className="text-xs text-blue-700 dark:text-blue-400">
            Instância conectada ao número de WhatsApp Business. Para gerenciar a conexão, acesse{" "}
            <a
              href="https://app.z-api.io"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-medium"
            >
              app.z-api.io
            </a>
            . O envio automático ocorre todos os dias às <strong>06:00 BRT</strong>. O texto é gerado automaticamente às <strong>05:45 BRT</strong> com base na Esteira de Conteúdo.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
