import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Clock,
  Activity,
  Mail,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";

export default function JobLogs() {
  const [isRunning, setIsRunning] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const utils = trpc.useUtils();

  const { data: jobStatus, isLoading: statusLoading } = trpc.jobs.status.useQuery(undefined, {
    refetchInterval: 15000,
  });

  const { data: logs, isLoading: logsLoading } = trpc.jobs.logs.useQuery(
    { limit: 30 },
    { refetchInterval: 30000 }
  );

  const runJobMutation = trpc.jobs.runNow.useMutation({
    onSuccess: (data) => {
      toast.success(`Job concluído: ${data.articlesAdded} novos artigos`);
      utils.jobs.status.invalidate();
      utils.jobs.logs.invalidate();
      utils.articles.stats.invalidate();
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const { data: emailStatus } = trpc.email.status.useQuery(undefined, {
    refetchInterval: 30000,
  });

  const sendEmailMutation = trpc.email.sendNow.useMutation({
    onSuccess: (data) => {
      if (data.sent) {
        toast.success(`Briefing enviado para ${data.subscriberCount} assinante(s)!`);
      } else {
        toast.info(data.message);
      }
      utils.email.status.invalidate();
    },
    onError: (err) => toast.error(`Erro ao enviar: ${err.message}`),
  });

  const handleSendEmail = async () => {
    setIsSendingEmail(true);
    try {
      await sendEmailMutation.mutateAsync({ force: true });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleRun = async () => {
    setIsRunning(true);
    try {
      await runJobMutation.mutateAsync();
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Status do Sistema</h1>
          <p className="text-sm text-muted-foreground">
            Monitoramento do job de coleta de feeds RSS
          </p>
        </div>
        <Button onClick={handleRun} disabled={isRunning} variant="outline">
          {isRunning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Executar agora
        </Button>
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-2">
                <Activity className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status atual</p>
                {statusLoading ? (
                  <Skeleton className="mt-1 h-5 w-20" />
                ) : (
                  <div className="flex items-center gap-1.5">
                    {jobStatus?.lastStatus === "success" ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                          Operacional
                        </span>
                      </>
                    ) : jobStatus?.lastStatus === "error" ? (
                      <>
                        <AlertCircle className="h-4 w-4 text-destructive" />
                        <span className="text-sm font-semibold text-destructive">Erro</span>
                      </>
                    ) : jobStatus?.lastStatus === "running" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span className="text-sm font-semibold text-primary">Executando</span>
                      </>
                    ) : (
                      <span className="text-sm text-muted-foreground">Aguardando</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-amber-100 p-2 dark:bg-amber-900/30">
                <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Última execução</p>
                {statusLoading ? (
                  <Skeleton className="mt-1 h-5 w-28" />
                ) : jobStatus?.lastRun ? (
                  <p className="text-sm font-semibold text-foreground">
                    {formatDistanceToNow(new Date(jobStatus.lastRun), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Nunca executado</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-sky-100 p-2 dark:bg-sky-900/30">
                <RefreshCw className="h-5 w-5 text-sky-600 dark:text-sky-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Próxima execução</p>
                {statusLoading ? (
                  <Skeleton className="mt-1 h-5 w-28" />
                ) : jobStatus?.nextRun ? (
                  <p className="text-sm font-semibold text-foreground">
                    {formatDistanceToNow(new Date(jobStatus.nextRun), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">—</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>


      {/* Email Status Card */}
      <Card className="border-green-100 bg-green-50/50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-green-700" />
              <CardTitle className="text-sm text-green-800">Briefing Diário por E-mail</CardTitle>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-green-300 text-green-700 hover:bg-green-100"
              onClick={handleSendEmail}
              disabled={isSendingEmail}
            >
              {isSendingEmail ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Send className="h-3 w-3 mr-1" />
              )}
              Enviar agora
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <div className="flex justify-between rounded-md bg-white/70 px-3 py-2 border border-green-100">
              <span className="text-muted-foreground">Horário programado</span>
              <span className="font-medium text-green-700">07:00 BRT</span>
            </div>
            <div className="flex justify-between rounded-md bg-white/70 px-3 py-2 border border-green-100">
              <span className="text-muted-foreground">Enviado hoje</span>
              <span className={`font-medium ${emailStatus?.sentToday ? "text-emerald-600" : "text-amber-600"}`}>
                {emailStatus?.sentToday ? "✓ Sim" : "Não"}
              </span>
            </div>
            <div className="flex justify-between rounded-md bg-white/70 px-3 py-2 border border-green-100">
              <span className="text-muted-foreground">Frequência</span>
              <span className="font-medium">Diária automática</span>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            O briefing executivo é enviado automaticamente todos os dias às 07:00 (horário de Brasília) para todos os assinantes ativos, incluindo cotações de commodities e o resumo gerado pela IA.
          </p>
        </CardContent>
      </Card>

      {/* Job Configuration Info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Configuração do Job</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="flex justify-between rounded-md bg-muted/40 px-3 py-2">
              <span className="text-muted-foreground">Frequência</span>
              <span className="font-medium">A cada 6 horas</span>
            </div>
            <div className="flex justify-between rounded-md bg-muted/40 px-3 py-2">
              <span className="text-muted-foreground">Modo</span>
              <span className="font-medium">Automático + Manual</span>
            </div>
            <div className="flex justify-between rounded-md bg-muted/40 px-3 py-2">
              <span className="text-muted-foreground">Resumo IA</span>
              <span className="font-medium">Gerado após cada coleta</span>
            </div>
            <div className="flex justify-between rounded-md bg-muted/40 px-3 py-2">
              <span className="text-muted-foreground">Deduplicação</span>
              <span className="font-medium">Por GUID do artigo</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Histórico de Execuções</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {logsLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-md" />
              ))}
            </div>
          ) : logs && logs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                      Início
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                      Duração
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                      Artigos
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                      Mensagem
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const duration =
                      log.finishedAt && log.startedAt
                        ? Math.round(
                            (new Date(log.finishedAt).getTime() -
                              new Date(log.startedAt).getTime()) /
                              1000
                          )
                        : null;

                    return (
                      <tr
                        key={log.id}
                        className="border-b border-border/50 last:border-0 hover:bg-muted/20"
                      >
                        <td className="px-4 py-2">
                          {log.status === "success" ? (
                            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-0 text-xs">
                              Sucesso
                            </Badge>
                          ) : log.status === "error" ? (
                            <Badge variant="destructive" className="text-xs">
                              Erro
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              Executando
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-2 text-xs text-muted-foreground">
                          {format(new Date(log.startedAt), "dd/MM HH:mm", { locale: ptBR })}
                        </td>
                        <td className="px-4 py-2 text-xs text-muted-foreground">
                          {duration !== null ? `${duration}s` : "—"}
                        </td>
                        <td className="px-4 py-2 text-xs font-medium text-foreground">
                          {log.articlesAdded ?? 0}
                        </td>
                        <td className="px-4 py-2 text-xs text-muted-foreground max-w-xs truncate">
                          {log.message ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Activity className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Nenhuma execução registrada ainda.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
