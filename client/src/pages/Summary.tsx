import { trpc } from "@/lib/trpc";
import { CategoryBadge } from "@/components/CategoryBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sparkles,
  Calendar,
  Loader2,
  FileText,
  TrendingUp,
  CalendarDays,
  CalendarRange,
  CalendarClock,
  Copy,
} from "lucide-react";
import { Streamdown } from "streamdown";
import { toast } from "sonner";
import { format, isToday, isYesterday, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { PaywallGate } from "@/components/PaywallGate";

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Parse a date field from the DB (DATE type comes as UTC midnight, e.g. 2026-04-09T00:00:00.000Z)
// We extract the YYYY-MM-DD part and create a LOCAL date to avoid timezone shift
function parseDbDate(dateStr: string | Date): Date {
  const iso = dateStr instanceof Date ? dateStr.toISOString() : new Date(dateStr).toISOString();
  const [y, m, d] = iso.split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, d); // local midnight — no UTC offset issues
}

function formatDailyDate(dateStr: string | Date): string {
  const d = parseDbDate(dateStr);
  if (isToday(d)) return "Hoje";
  if (isYesterday(d)) return "Ontem";
  return format(d, "dd 'de' MMMM", { locale: ptBR });
}

function formatPeriodLabel(label: string, type: "weekly" | "monthly"): string {
  if (type === "monthly") {
    const [year, month] = label.split("-");
    const d = new Date(Number(year), Number(month) - 1, 1);
    return format(d, "MMMM yyyy", { locale: ptBR });
  }
  // weekly: "2026-W12"
  const match = label.match(/(\d+)-W(\d+)/);
  if (!match) return label;
  return `Semana ${match[2]} / ${match[1]}`;
}

function formatCustomLabel(label: string): string {
  // label format: "YYYY-MM-DD_YYYY-MM-DD"
  const parts = label.split("_");
  if (parts.length !== 2) return label;
  const [from, to] = parts;
  const dFrom = new Date(from + "T00:00:00");
  const dTo = new Date(to + "T00:00:00");
  return `${format(dFrom, "dd/MM/yyyy")} – ${format(dTo, "dd/MM/yyyy")}`;
}

function parseHighlights(raw: string | null | undefined) {
  try {
    return JSON.parse(raw ?? "[]") as Array<{
      title: string;
      description: string;
      category: string;
    }>;
  } catch {
    return [];
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function HighlightsGrid({ highlights }: { highlights: ReturnType<typeof parseHighlights> }) {
  if (highlights.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <TrendingUp className="h-4 w-4 text-primary" />
          Principais Destaques
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {highlights.map((h, i) => (
            <div
              key={i}
              className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5"
            >
              <div className="flex items-start gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {i + 1}
                </span>
                <p className="text-xs font-semibold text-foreground leading-snug">{h.title}</p>
              </div>
              <p className="text-xs text-muted-foreground pl-7">{h.description}</p>
              <div className="pl-7">
                <CategoryBadge category={h.category} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryBody({
  isLoading,
  summary,
  dateLabel,
  onGenerate,
  isGenerating,
  generateLabel,
}: {
  isLoading: boolean;
  summary: { content: string; articleCount: number; generatedAt: Date } | null | undefined;
  dateLabel: string;
  onGenerate: () => void;
  isGenerating: boolean;
  generateLabel: string;
}) {
  const highlights = parseHighlights(
    (summary as { highlights?: string | null } | null | undefined)?.highlights
  );

  return (
    <div className="space-y-4">
      {/* Resumo no topo */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-primary" />
              {summary ? dateLabel : "Briefing Executivo"}
            </CardTitle>
            {summary && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {summary.articleCount} artigos analisados
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Gerado em{" "}
                  {format(new Date(summary.generatedAt), "HH:mm", { locale: ptBR })}
                </span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-4" style={{ width: `${70 + Math.random() * 30}%` }} />
              ))}
            </div>
          ) : summary ? (
            <div className="prose prose-sm max-w-none dark:prose-invert [&_p]:text-justify [&_p]:hyphens-auto">
              <Streamdown>{summary.content}</Streamdown>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Sparkles className="mb-4 h-14 w-14 text-muted-foreground/30" />
              <p className="text-base font-medium text-muted-foreground">
                Nenhum resumo disponível
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Clique em "{generateLabel}" para gerar o briefing.
              </p>
              <Button className="mt-4" onClick={onGenerate} disabled={isGenerating}>
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {generateLabel}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      {/* Principais destaques abaixo do resumo */}
      <HighlightsGrid highlights={highlights} />
    </div>
  );
}

// ─── Daily Tab ────────────────────────────────────────────────────────────────

function DailyTab() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const utils = trpc.useUtils();

  const { data: recentSummaries, isLoading: recentLoading } = trpc.summaries.recent.useQuery({ limit: 14 });
  const { data: latestSummary, isLoading: latestLoading } = trpc.summaries.latest.useQuery();

  const generateMutation = trpc.summaries.generate.useMutation({
    onSuccess: () => {
      toast.success("Resumo diário gerado com sucesso!");
      utils.summaries.latest.invalidate();
      utils.summaries.recent.invalidate();
      setSelectedId(null);
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      await generateMutation.mutateAsync({});
    } finally {
      setIsGenerating(false);
    }
  };

  const displaySummary =
    selectedId !== null
      ? (recentSummaries?.find((s) => s.id === selectedId) ?? null)
      : (latestSummary ?? null);

  return (
    <div className="grid gap-6 lg:grid-cols-4">
      {/* Sidebar */}
      <div className="lg:col-span-1">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-primary" />
              Histórico Diário
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            {recentLoading ? (
              <div className="space-y-2 p-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 rounded-md" />
                ))}
              </div>
            ) : recentSummaries && recentSummaries.length > 0 ? (
              <div className="space-y-1">
                {recentSummaries.map((summary) => (
                  <button
                    key={summary.id}
                    onClick={() => setSelectedId(selectedId === summary.id ? null : summary.id)}
                    className={`w-full rounded-md px-3 py-2 text-left transition-colors ${
                      (selectedId === null && summary.id === latestSummary?.id) ||
                      selectedId === summary.id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-accent text-foreground"
                    }`}
                  >
                    <p className="text-xs font-semibold">
                      {formatDailyDate(summary.summaryDate)}
                    </p>
                    <p
                      className={`text-xs ${
                        (selectedId === null && summary.id === latestSummary?.id) ||
                        selectedId === summary.id
                          ? "text-primary-foreground/70"
                          : "text-muted-foreground"
                      }`}
                    >
                      {summary.articleCount} artigos
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <p className="p-3 text-xs text-muted-foreground text-center">
                Nenhum resumo gerado ainda.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main */}
      <div className="lg:col-span-3">
        <SummaryBody
          isLoading={latestLoading}
          summary={displaySummary}
          dateLabel={displaySummary ? `Briefing de ${formatDailyDate(displaySummary.summaryDate)}` : ""}
          onGenerate={handleGenerate}
          isGenerating={isGenerating}
          generateLabel="Gerar resumo de hoje"
        />
      </div>
    </div>
  );
}

// ─── Periodic Tab (weekly or monthly) ────────────────────────────────────────

function PeriodicTab({ type }: { type: "weekly" | "monthly" }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const utils = trpc.useUtils();

  const { data: recentList, isLoading: listLoading } = trpc.summaries.recentPeriodic.useQuery({
    type,
    limit: 12,
  });
  const { data: latestSummary, isLoading: latestLoading } = trpc.summaries.latestPeriodic.useQuery({ type });

  const weeklyMutation = trpc.summaries.generateWeekly.useMutation({
    onSuccess: () => {
      toast.success("Resumo semanal gerado com sucesso!");
      utils.summaries.latestPeriodic.invalidate({ type });
      utils.summaries.recentPeriodic.invalidate({ type });
      setSelectedId(null);
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const monthlyMutation = trpc.summaries.generateMonthly.useMutation({
    onSuccess: () => {
      toast.success("Resumo mensal gerado com sucesso!");
      utils.summaries.latestPeriodic.invalidate({ type });
      utils.summaries.recentPeriodic.invalidate({ type });
      setSelectedId(null);
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      if (type === "weekly") await weeklyMutation.mutateAsync({});
      else await monthlyMutation.mutateAsync({});
    } finally {
      setIsGenerating(false);
    }
  };

  const displaySummary =
    selectedId !== null
      ? (recentList?.find((s) => s.id === selectedId) ?? null)
      : (latestSummary ?? null);

  const generateLabel = type === "weekly" ? "Gerar resumo semanal" : "Gerar resumo mensal";
  const historyTitle = type === "weekly" ? "Histórico Semanal" : "Histórico Mensal";

  return (
    <div className="grid gap-6 lg:grid-cols-4">
      {/* Sidebar */}
      <div className="lg:col-span-1">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-primary" />
              {historyTitle}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            {listLoading ? (
              <div className="space-y-2 p-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 rounded-md" />
                ))}
              </div>
            ) : recentList && recentList.length > 0 ? (
              <div className="space-y-1">
                {recentList.map((summary) => (
                  <button
                    key={summary.id}
                    onClick={() => setSelectedId(selectedId === summary.id ? null : summary.id)}
                    className={`w-full rounded-md px-3 py-2 text-left transition-colors ${
                      (selectedId === null && summary.id === latestSummary?.id) ||
                      selectedId === summary.id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-accent text-foreground"
                    }`}
                  >
                    <p className="text-xs font-semibold capitalize">
                      {formatPeriodLabel(summary.periodLabel, type)}
                    </p>
                    <p
                      className={`text-xs ${
                        (selectedId === null && summary.id === latestSummary?.id) ||
                        selectedId === summary.id
                          ? "text-primary-foreground/70"
                          : "text-muted-foreground"
                      }`}
                    >
                      {summary.articleCount} artigos
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <p className="p-3 text-xs text-muted-foreground text-center">
                Nenhum resumo gerado ainda.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main */}
      <div className="lg:col-span-3">
        <SummaryBody
          isLoading={latestLoading}
          summary={displaySummary}
          dateLabel={
            displaySummary
              ? `Briefing ${type === "weekly" ? "Semanal" : "Mensal"} — ${formatPeriodLabel(displaySummary.periodLabel, type)}`
              : ""
          }
          onGenerate={handleGenerate}
          isGenerating={isGenerating}
          generateLabel={generateLabel}
        />
      </div>
    </div>
  );
}

// ─── Custom Period Tab ────────────────────────────────────────────────────────

function CustomPeriodTab() {
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);

  const [dateFrom, setDateFrom] = useState(() => format(thirtyDaysAgo, "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(() => format(today, "yyyy-MM-dd"));
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSummary, setGeneratedSummary] = useState<{
    content: string;
    highlights: string;
    articleCount: number;
    periodLabel: string;
    periodStart: Date;
    periodEnd: Date;
  } | null>(null);
  const utils = trpc.useUtils();

  const { data: historyList, isLoading: historyLoading } = trpc.summaries.recentCustom.useQuery({ limit: 20 });

  const generateMutation = trpc.summaries.generateCustomPeriod.useMutation({
    onSuccess: (data) => {
      toast.success("Briefing por período gerado com sucesso!");
      setGeneratedSummary(data);
      setSelectedId(null);
      utils.summaries.recentCustom.invalidate();
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const handleGenerate = async () => {
    if (!dateFrom || !dateTo) {
      toast.error("Selecione as datas De e Até.");
      return;
    }
    const from = new Date(dateFrom + "T00:00:00");
    const to = new Date(dateTo + "T23:59:59");
    if (from > to) {
      toast.error("A data inicial deve ser anterior à data final.");
      return;
    }
    setIsGenerating(true);
    try {
      await generateMutation.mutateAsync({ dateFrom: from, dateTo: to });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    const content = displaySummary?.content;
    if (!content) return;
    navigator.clipboard.writeText(content).then(() => toast.success("Briefing copiado!"));
  };

  // Determine which summary to display
  const selectedHistoryEntry = selectedId !== null
    ? historyList?.find((s) => s.id === selectedId) ?? null
    : null;

  // Display: selected history entry > freshly generated > null
  const displaySummary: {
    content: string;
    highlights?: string | null;
    articleCount: number;
    generatedAt: Date;
    periodLabel?: string;
  } | null = selectedHistoryEntry
    ? {
        content: selectedHistoryEntry.content,
        highlights: selectedHistoryEntry.highlights,
        articleCount: selectedHistoryEntry.articleCount,
        generatedAt: new Date(selectedHistoryEntry.generatedAt),
        periodLabel: selectedHistoryEntry.periodLabel,
      }
    : generatedSummary
    ? {
        content: generatedSummary.content,
        highlights: generatedSummary.highlights,
        articleCount: generatedSummary.articleCount,
        generatedAt: new Date(),
        periodLabel: generatedSummary.periodLabel,
      }
    : null;

  const daysDiff = dateFrom && dateTo
    ? differenceInDays(new Date(dateTo + "T00:00:00"), new Date(dateFrom + "T00:00:00")) + 1
    : 0;

  const highlights = parseHighlights(displaySummary?.highlights);

  const displayLabel = displaySummary?.periodLabel
    ? `Briefing Por Período — ${formatCustomLabel(displaySummary.periodLabel)}`
    : "Briefing Por Período";

  return (
    <div className="grid gap-6 lg:grid-cols-4">
      {/* Sidebar */}
      <div className="lg:col-span-1 space-y-4">
        {/* Date selector */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <CalendarClock className="h-4 w-4 text-primary" />
              Selecionar Período
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">De</label>
              <input
                type="date"
                value={dateFrom}
                max={dateTo || format(today, "yyyy-MM-dd")}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Até</label>
              <input
                type="date"
                value={dateTo}
                min={dateFrom}
                max={format(today, "yyyy-MM-dd")}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            {daysDiff > 0 && (
              <p className="text-xs text-muted-foreground text-center">
                {daysDiff} {daysDiff === 1 ? "dia" : "dias"} no período
              </p>
            )}
            <Button
              className="w-full"
              size="sm"
              onClick={handleGenerate}
              disabled={isGenerating || !dateFrom || !dateTo}
            >
              {isGenerating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {isGenerating ? "Gerando..." : "Gerar Briefing"}
            </Button>
          </CardContent>
        </Card>

        {/* History */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-primary" />
              Histórico Por Período
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            {historyLoading ? (
              <div className="space-y-2 p-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-md" />
                ))}
              </div>
            ) : historyList && historyList.length > 0 ? (
              <div className="space-y-1">
                {historyList.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => {
                      setSelectedId(selectedId === entry.id ? null : entry.id);
                      setGeneratedSummary(null);
                    }}
                    className={`w-full rounded-md px-3 py-2 text-left transition-colors ${
                      selectedId === entry.id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-accent text-foreground"
                    }`}
                  >
                    <p className="text-xs font-semibold leading-snug">
                      {formatCustomLabel(entry.periodLabel)}
                    </p>
                    <p
                      className={`text-xs mt-0.5 ${
                        selectedId === entry.id
                          ? "text-primary-foreground/70"
                          : "text-muted-foreground"
                      }`}
                    >
                      {entry.articleCount} artigos
                    </p>
                    <p
                      className={`text-xs ${
                        selectedId === entry.id
                          ? "text-primary-foreground/60"
                          : "text-muted-foreground/70"
                      }`}
                    >
                      {format(new Date(entry.generatedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <p className="p-3 text-xs text-muted-foreground text-center">
                Nenhum briefing gerado ainda.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main content */}
      <div className="lg:col-span-3">
        {isGenerating ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-24 text-center">
              <Loader2 className="mb-4 h-12 w-12 animate-spin text-primary" />
              <p className="text-base font-medium text-foreground">Gerando briefing por período...</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Analisando artigos de {dateFrom ? format(new Date(dateFrom + "T00:00:00"), "dd/MM/yyyy") : "—"} a{" "}
                {dateTo ? format(new Date(dateTo + "T00:00:00"), "dd/MM/yyyy") : "—"}. Isso pode levar alguns instantes.
              </p>
            </CardContent>
          </Card>
        ) : displaySummary ? (
          <div className="space-y-4">
            {/* Resumo no topo */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="h-4 w-4 text-primary" />
                    {displayLabel}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {displaySummary.articleCount} artigos analisados
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Gerado em{" "}
                      {format(new Date(displaySummary.generatedAt), "dd/MM HH:mm", { locale: ptBR })}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={handleCopy}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copiar
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none dark:prose-invert [&_p]:text-justify [&_p]:hyphens-auto">
                  <Streamdown>{displaySummary.content}</Streamdown>
                </div>
              </CardContent>
            </Card>
            {/* Principais destaques abaixo do resumo */}
            <HighlightsGrid highlights={highlights} />
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-24 text-center">
              <CalendarClock className="mb-4 h-14 w-14 text-muted-foreground/30" />
              <p className="text-base font-medium text-muted-foreground">
                Selecione um período e gere o briefing
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Escolha as datas De e Até no painel à esquerda e clique em "Gerar Briefing".
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Cada geração cria uma entrada imutável no histórico.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Summary() {
  const [activeTab, setActiveTab] = useState<"daily" | "weekly" | "monthly" | "custom">("daily");
  const [isDailyGenerating, setIsDailyGenerating] = useState(false);
  const [isWeeklyGenerating, setIsWeeklyGenerating] = useState(false);
  const [isMonthlyGenerating, setIsMonthlyGenerating] = useState(false);
  const utils = trpc.useUtils();

  const dailyMutation = trpc.summaries.generate.useMutation({
    onSuccess: () => {
      toast.success("Resumo diário gerado!");
      utils.summaries.latest.invalidate();
      utils.summaries.recent.invalidate();
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const weeklyMutation = trpc.summaries.generateWeekly.useMutation({
    onSuccess: () => {
      toast.success("Resumo semanal gerado!");
      utils.summaries.latestPeriodic.invalidate({ type: "weekly" });
      utils.summaries.recentPeriodic.invalidate({ type: "weekly" });
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const monthlyMutation = trpc.summaries.generateMonthly.useMutation({
    onSuccess: () => {
      toast.success("Resumo mensal gerado!");
      utils.summaries.latestPeriodic.invalidate({ type: "monthly" });
      utils.summaries.recentPeriodic.invalidate({ type: "monthly" });
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const handleHeaderGenerate = async () => {
    if (activeTab === "daily") {
      setIsDailyGenerating(true);
      try { await dailyMutation.mutateAsync({}); } finally { setIsDailyGenerating(false); }
    } else if (activeTab === "weekly") {
      setIsWeeklyGenerating(true);
      try { await weeklyMutation.mutateAsync({}); } finally { setIsWeeklyGenerating(false); }
    } else if (activeTab === "monthly") {
      setIsMonthlyGenerating(true);
      try { await monthlyMutation.mutateAsync({}); } finally { setIsMonthlyGenerating(false); }
    }
    // For "custom" tab, generation is handled inside CustomPeriodTab
  };

  const isGenerating = isDailyGenerating || isWeeklyGenerating || isMonthlyGenerating;
  const generateLabel =
    activeTab === "daily"
      ? "Gerar resumo de hoje"
      : activeTab === "weekly"
      ? "Gerar resumo semanal"
      : activeTab === "monthly"
      ? "Gerar resumo mensal"
      : null; // custom tab has its own button

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Resumo IA</h1>
          <p className="text-sm text-muted-foreground">
            Briefings executivos gerados por inteligência artificial — diário, semanal, mensal e por período
          </p>
        </div>
        {generateLabel && (
          <Button onClick={handleHeaderGenerate} disabled={isGenerating}>
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {generateLabel}
          </Button>
        )}
      </div>

      <PaywallGate
        minPlan="morning_call"
        featureName="Resumos com IA"
        description="Acesse os briefings executivos diário, semanal e mensal com análise de todas as notícias do agronegócio, destaques por categoria e tendências de mercado."
      >
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "daily" | "weekly" | "monthly" | "custom")}
        >
          <TabsList className="mb-4">
            <TabsTrigger value="daily" className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              Diário
            </TabsTrigger>
            <TabsTrigger value="weekly" className="flex items-center gap-1.5">
              <CalendarRange className="h-3.5 w-3.5" />
              Semanal
            </TabsTrigger>
            <TabsTrigger value="monthly" className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Mensal
            </TabsTrigger>
            <TabsTrigger value="custom" className="flex items-center gap-1.5">
              <CalendarClock className="h-3.5 w-3.5" />
              Por Período
            </TabsTrigger>
          </TabsList>

          <TabsContent value="daily">
            <DailyTab />
          </TabsContent>

          <TabsContent value="weekly">
            <PeriodicTab type="weekly" />
          </TabsContent>

          <TabsContent value="monthly">
            <PeriodicTab type="monthly" />
          </TabsContent>

          <TabsContent
            value="custom"
            forceMount
            className="data-[state=inactive]:!hidden"
          >
            <CustomPeriodTab />
          </TabsContent>
        </Tabs>
      </PaywallGate>
    </div>
  );
}
