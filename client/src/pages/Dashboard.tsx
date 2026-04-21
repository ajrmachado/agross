import { trpc } from "@/lib/trpc";
import { ArticleCard } from "@/components/ArticleCard";
import { CategoryBadge } from "@/components/CategoryBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Newspaper,
  TrendingUp,
  Clock,
  RefreshCw,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Loader2,
  BarChart3,
  Rss,
} from "lucide-react";
import { Streamdown } from "streamdown";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { useLocation } from "wouter";

// ─── Commodity Widget ────────────────────────────────────────────────────────

const COMMODITY_COLORS: Record<string, string> = {
  "ZS=F": "#16a34a",  // verde - soja
  "ZC=F": "#d97706",  // âmbar - milho
  "ZW=F": "#b45309",  // marrom - trigo
  "CT=F": "#7c3aed",  // roxo - algodão
  "LE=F": "#dc2626",  // vermelho - boi gordo
  "GF=F": "#ea580c",  // laranja - boi alimentado
  "KC=F": "#6f4e37",  // marrom café - café arábica
  "SB=F": "#f59e0b",  // dourado - açúcar bruto
};

function CommodityWidget() {
  const [, setLocation] = useLocation();
  const { data: quotes = [], isLoading } = trpc.commodities.quotes.useQuery(
    undefined,
    { refetchInterval: 5 * 60 * 1000 }
  );

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
    );
  }

  if (quotes.length === 0) return null;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
          <BarChart3 className="h-4 w-4" />
          Cotações de Commodities
        </h2>
        <button
          onClick={() => setLocation("/commodities")}
          className="text-xs text-primary hover:underline"
        >
          Ver detalhes →
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {quotes.map((q) => {
          const isUp = q.change > 0;
          const isDown = q.change < 0;
          const color = COMMODITY_COLORS[q.symbol] ?? "#6b7280";
          const usdPrice = q.currency === "USX" ? q.price / 100 : q.price;
          return (
            <Card
              key={q.symbol}
              className="cursor-pointer hover:shadow-md transition-shadow border-0 shadow-sm"
              onClick={() => setLocation("/commodities")}
            >
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{q.flag}</span>
                    <div>
                      <p className="text-sm font-semibold text-foreground leading-tight">{q.name}</p>
                      <p className="text-xs text-muted-foreground">{q.symbol}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold" style={{ color }}>
                      US$ {usdPrice.toFixed(2)}
                    </p>
                    <p
                      className={`text-xs font-medium ${
                        isUp ? "text-green-600" : isDown ? "text-red-600" : "text-muted-foreground"
                      }`}
                    >
                      {isUp ? "+" : ""}{q.changePct.toFixed(2)}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [isRunningJob, setIsRunningJob] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  const utils = trpc.useUtils();

  const { data: stats, isLoading: statsLoading } = trpc.articles.stats.useQuery();
  const { data: latestSummary, isLoading: summaryLoading } = trpc.summaries.latest.useQuery();
  const { data: jobStatus } = trpc.jobs.status.useQuery(undefined, {
    refetchInterval: 30000,
  });
  const { data: articlesData, isLoading: articlesLoading } = trpc.articles.list.useQuery({
    limit: 12,
    offset: 0,
  });

  const runJobMutation = trpc.jobs.runNow.useMutation({
    onSuccess: (data) => {
      toast.success(`Job concluído: ${data.articlesAdded} novos artigos adicionados`);
      utils.articles.list.invalidate();
      utils.articles.stats.invalidate();
      utils.jobs.status.invalidate();
    },
    onError: (err) => toast.error(`Erro ao executar job: ${err.message}`),
  });

  const generateSummaryMutation = trpc.summaries.generate.useMutation({
    onSuccess: () => {
      toast.success("Resumo diário gerado com sucesso!");
      utils.summaries.latest.invalidate();
    },
    onError: (err) => toast.error(`Erro ao gerar resumo: ${err.message}`),
  });

  const handleRunJob = async () => {
    setIsRunningJob(true);
    try {
      await runJobMutation.mutateAsync();
    } finally {
      setIsRunningJob(false);
    }
  };

  const handleGenerateSummary = async () => {
    setIsGeneratingSummary(true);
    try {
      await generateSummaryMutation.mutateAsync({});
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const highlights = (() => {
    try {
      return JSON.parse(latestSummary?.highlights ?? "[]") as Array<{
        title: string;
        description: string;
        category: string;
      }>;
    } catch {
      return [];
    }
  })();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Monitoramento em tempo real do agronegócio
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRunJob}
            disabled={isRunningJob}
          >
            {isRunningJob ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Atualizar feeds
          </Button>
          <Button size="sm" onClick={handleGenerateSummary} disabled={isGeneratingSummary}>
            {isGeneratingSummary ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Gerar resumo IA
          </Button>
        </div>
      </div>

      {/* Commodity Quotes Widget */}
      <CommodityWidget />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total de artigos</p>
                {statsLoading ? (
                  <Skeleton className="mt-1 h-7 w-16" />
                ) : (
                  <p className="text-2xl font-bold text-foreground">
                    {stats?.total?.toLocaleString("pt-BR") ?? 0}
                  </p>
                )}
              </div>
              <div className="rounded-full bg-primary/10 p-2">
                <Newspaper className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Hoje</p>
                {statsLoading ? (
                  <Skeleton className="mt-1 h-7 w-16" />
                ) : (
                  <p className="text-2xl font-bold text-foreground">
                    {stats?.today ?? 0}
                  </p>
                )}
              </div>
              <div className="rounded-full bg-amber-100 p-2 dark:bg-amber-900/30">
                <TrendingUp className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Fontes ativas</p>
                {statsLoading ? (
                  <Skeleton className="mt-1 h-7 w-16" />
                ) : (
                  <p className="text-2xl font-bold text-foreground">
                    {stats?.bySource?.length ?? 0}
                  </p>
                )}
              </div>
              <div className="rounded-full bg-sky-100 p-2 dark:bg-sky-900/30">
                <Rss className="h-5 w-5 text-sky-600 dark:text-sky-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Status do job</p>
                <div className="mt-1 flex items-center gap-1.5">
                  {jobStatus?.lastStatus === "success" ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">OK</span>
                    </>
                  ) : jobStatus?.lastStatus === "error" ? (
                    <>
                      <AlertCircle className="h-4 w-4 text-destructive" />
                      <span className="text-sm font-semibold text-destructive">Erro</span>
                    </>
                  ) : jobStatus?.lastStatus === "running" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-sm font-semibold text-primary">Rodando</span>
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </div>
              </div>
              <div className="rounded-full bg-purple-100 p-2 dark:bg-purple-900/30">
                <Clock className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            {jobStatus?.lastRun && (
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(jobStatus.lastRun), {
                  addSuffix: true,
                  locale: ptBR,
                })}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* AI Summary */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Resumo IA do Dia
                </CardTitle>
                {latestSummary && (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {latestSummary.articleCount} artigos analisados
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {(() => { const iso = latestSummary.summaryDate instanceof Date ? latestSummary.summaryDate.toISOString() : new Date(latestSummary.summaryDate as string).toISOString(); const [y,m,d] = iso.split('T')[0].split('-'); return `${d}/${m}/${y}`; })()}
                    </span>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-4/6" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ) : latestSummary ? (
                <div className="prose prose-sm max-w-none dark:prose-invert [&_p]:text-justify [&_p]:hyphens-auto">
                  <Streamdown>{latestSummary.content}</Streamdown>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Sparkles className="mb-3 h-10 w-10 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    Nenhum resumo gerado ainda.
                  </p>
                  <Button
                    size="sm"
                    className="mt-3"
                    onClick={handleGenerateSummary}
                    disabled={isGeneratingSummary}
                  >
                    {isGeneratingSummary ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Gerar agora
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Highlights + Category Stats */}
        <div className="space-y-4">
          {/* Highlights */}
          {highlights.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Principais Destaques</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {highlights.map((h, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-foreground">{h.title}</p>
                      <p className="text-xs text-muted-foreground">{h.description}</p>
                      <CategoryBadge category={h.category} className="mt-1" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Category Distribution */}
          {stats && stats.byCategory.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Por Categoria
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {stats.byCategory
                  .sort((a, b) => b.total - a.total)
                  .map((cat) => (
                    <div key={cat.category} className="flex items-center justify-between">
                      <CategoryBadge category={cat.category} />
                      <span className="text-xs font-medium text-muted-foreground">
                        {cat.total}
                      </span>
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Recent Articles */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Artigos Recentes</h2>
          <a href="/articles" className="text-sm text-primary hover:underline">
            Ver todos →
          </a>
        </div>
        {articlesLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-36 rounded-lg" />
            ))}
          </div>
        ) : articlesData && articlesData.items.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {articlesData.items.map((article) => (
              <ArticleCard
                key={article.id}
                title={article.title}
                description={article.description}
                link={article.link}
                source={article.source}
                category={article.category}
                publishedAt={article.publishedAt}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
            <Newspaper className="mb-3 h-12 w-12 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">
              Nenhum artigo coletado ainda.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Clique em "Atualizar feeds" para buscar os primeiros artigos.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
