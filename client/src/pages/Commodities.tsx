import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Info,
  BarChart2,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { PaywallGate } from "@/components/PaywallGate";

type RangeOption = "1mo" | "3mo" | "6mo" | "1y";

const RANGE_LABELS: Record<RangeOption, string> = {
  "1mo": "1 Mês",
  "3mo": "3 Meses",
  "6mo": "6 Meses",
  "1y": "1 Ano",
};

// Cores por símbolo
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

// Agrupamento por categoria
const GROUPS = [
  {
    label: "Grãos",
    symbols: ["ZS=F", "ZC=F", "ZW=F"],
  },
  {
    label: "Pecuária",
    symbols: ["LE=F", "GF=F"],
  },
  {
    label: "Fibras e Outros",
    symbols: ["CT=F", "KC=F", "SB=F"],
  },
];

function formatPrice(price: number, unit: string) {
  if (unit === "USX/bu" || unit === "USX/lb" || unit === "USX/cwt") {
    const usd = price / 100;
    return `US$ ${usd.toFixed(2)}`;
  }
  return `${price.toFixed(2)}`;
}

function formatPriceRaw(price: number) {
  return price.toFixed(2);
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function formatDateFull(ts: number) {
  return new Date(ts).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

type Quote = {
  symbol: string;
  name: string;
  nameEn: string;
  unit: string;
  flag: string;
  brlUnit?: string;
  category?: string;
  convKey?: string;
  price: number;
  prevClose: number;
  change: number;
  changePct: number;
  currency: string;
  exchange: string;
  fetchedAt: Date;
  usdBrl?: number;
  brlPrice?: number;
  brlPriceSaca?: number;
  brlPriceTon?: number;
  brlPriceArroba?: number;
  brlPriceKg?: number;
  brlPriceBushel?: number;
};

function QuoteCard({ quote }: { quote: Quote }) {
  const isUp = quote.change > 0;
  const isDown = quote.change < 0;
  const color = COMMODITY_COLORS[quote.symbol] ?? "#6b7280";

  return (
    <Card className="relative overflow-hidden border-0 shadow-md">
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ backgroundColor: color }}
      />
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{quote.flag}</span>
            <div>
              <p className="font-bold text-foreground text-base leading-tight">{quote.name}</p>
              <p className="text-xs text-muted-foreground">{quote.nameEn} · {quote.exchange}</p>
            </div>
          </div>
          <Badge
            variant="outline"
            className={
              isUp
                ? "border-green-500 text-green-600 bg-green-50"
                : isDown
                ? "border-red-500 text-red-600 bg-red-50"
                : "border-gray-400 text-gray-600"
            }
          >
            {isUp ? (
              <TrendingUp className="w-3 h-3 mr-1" />
            ) : isDown ? (
              <TrendingDown className="w-3 h-3 mr-1" />
            ) : (
              <Minus className="w-3 h-3 mr-1" />
            )}
            {isUp ? "+" : ""}{quote.changePct.toFixed(2)}%
          </Badge>
        </div>

        {/* Preço principal em USD */}
        <div className="mt-2">
          <p className="text-2xl font-bold text-foreground">
            {formatPrice(quote.price, quote.unit)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {quote.unit} · {quote.currency === "USX" ? "centavos USD" : quote.currency}
          </p>
        </div>

        {/* Preço em BRL */}
        {quote.brlPrice != null && quote.brlUnit && (
          <div className="mt-2 px-3 py-2 rounded-md bg-green-50 border border-green-100">
            <p className="text-base font-bold text-green-700">
              R$ {quote.brlPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-green-600">
              {quote.brlUnit}{quote.usdBrl ? ` · Câmbio: R$ ${quote.usdBrl.toFixed(2)}/USD` : ""}
            </p>
          </div>
        )}

        <div className="mt-3 pt-3 border-t border-border flex justify-between text-xs text-muted-foreground">
          <span>
            Variação:{" "}
            <span className={isUp ? "text-green-600 font-medium" : isDown ? "text-red-600 font-medium" : ""}>
              {isUp ? "+" : ""}{formatPrice(quote.change, quote.unit)}
            </span>
          </span>
          <span>
            Fech. ant.: {formatPrice(quote.prevClose, quote.unit)}
          </span>
        </div>

        <p className="text-xs text-muted-foreground mt-2">
          Atualizado: {new Date(quote.fetchedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </CardContent>
    </Card>
  );
}

type HistoryPoint = { ts: number; close: number };

function GroupChart({
  symbols,
  histories,
  quotes,
}: {
  symbols: string[];
  histories: Record<string, HistoryPoint[]>;
  quotes: Quote[];
}) {
  const groupQuotes = quotes.filter((q) => symbols.includes(q.symbol));

  const allTs = new Set<number>();
  symbols.forEach((sym) => (histories[sym] ?? []).forEach((p) => allTs.add(p.ts)));
  const sortedTs = Array.from(allTs).sort((a, b) => a - b);

  const data = sortedTs.map((ts) => {
    const row: Record<string, unknown> = { ts, date: formatDate(ts) };
    groupQuotes.forEach((q) => {
      const hist = histories[q.symbol] ?? [];
      const point = hist.find((p) => p.ts === ts);
      if (point) row[q.name] = point.close;
    });
    return row;
  });

  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
        Sem dados históricos disponíveis para este período.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          {groupQuotes.map((q) => (
            <linearGradient key={q.symbol} id={`grad-${q.symbol}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COMMODITY_COLORS[q.symbol]} stopOpacity={0.15} />
              <stop offset="95%" stopColor={COMMODITY_COLORS[q.symbol]} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => formatPriceRaw(Number(v))}
          width={65}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
            fontSize: "12px",
          }}
          formatter={(value: number, name: string) => {
            const q = groupQuotes.find((q) => q.name === name);
            return [formatPriceRaw(value) + ` ${q?.unit ?? "USX"}`, name];
          }}
          labelFormatter={(label, payload) => {
            if (payload && payload.length > 0) {
              const ts = (payload[0].payload as { ts: number }).ts;
              return formatDateFull(ts);
            }
            return label;
          }}
        />
        <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
        {groupQuotes.map((q) => (
          <Area
            key={q.symbol}
            type="monotone"
            dataKey={q.name}
            stroke={COMMODITY_COLORS[q.symbol]}
            strokeWidth={2}
            fill={`url(#grad-${q.symbol})`}
            dot={false}
            connectNulls
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export default function CommoditiesPage() {
  const { isAuthenticated } = useAuth();
  const [range, setRange] = useState<RangeOption>("3mo");

  const { data: quotes = [], isLoading: loadingQuotes, refetch: refetchQuotes } =
    trpc.commodities.quotes.useQuery(undefined, { refetchInterval: 5 * 60 * 1000 });

  // Fetch history for each commodity
  const sojaHistory    = trpc.commodities.history.useQuery({ symbol: "ZS=F", range });
  const milhoHistory   = trpc.commodities.history.useQuery({ symbol: "ZC=F", range });
  const trigoHistory   = trpc.commodities.history.useQuery({ symbol: "ZW=F", range });
  const algodaoHistory = trpc.commodities.history.useQuery({ symbol: "CT=F", range });
  const boiGordoHistory = trpc.commodities.history.useQuery({ symbol: "LE=F", range });
  const boiAlimHistory = trpc.commodities.history.useQuery({ symbol: "GF=F", range });

  const histories = useMemo<Record<string, HistoryPoint[]>>(() => ({
    "ZS=F": sojaHistory.data ?? [],
    "ZC=F": milhoHistory.data ?? [],
    "ZW=F": trigoHistory.data ?? [],
    "CT=F": algodaoHistory.data ?? [],
    "LE=F": boiGordoHistory.data ?? [],
    "GF=F": boiAlimHistory.data ?? [],
  }), [
    sojaHistory.data, milhoHistory.data, trigoHistory.data,
    algodaoHistory.data, boiGordoHistory.data, boiAlimHistory.data,
  ]);

  const refreshMutation = trpc.commodities.refresh.useMutation({
    onSuccess: () => {
      refetchQuotes();
      toast.success("Cotações atualizadas com sucesso!");
    },
    onError: () => toast.error("Erro ao atualizar cotações"),
  });

  const isLoadingHistory =
    sojaHistory.isLoading || milhoHistory.isLoading || trigoHistory.isLoading ||
    algodaoHistory.isLoading || boiGordoHistory.isLoading || boiAlimHistory.isLoading;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-primary" />
            Cotações de Commodities
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Futuros agrícolas em tempo real via Yahoo Finance (CBOT / CME / NYMEX)
          </p>
        </div>
        {isAuthenticated && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        )}
      </div>

      {/* Card USD/BRL */}
      {quotes.length > 0 && quotes[0]?.usdBrl && (
        <div className="flex items-center justify-between bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-xl">🇺🇸</div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Câmbio USD/BRL</p>
              <p className="text-2xl font-bold text-green-700 font-mono leading-tight">
                R$ {quotes[0].usdBrl!.toFixed(4)}
              </p>
              <p className="text-xs text-muted-foreground">Dólar Comercial · Atualizado automaticamente</p>
            </div>
          </div>
          <div className="text-right">
            <a
              href="/conversao"
              className="inline-flex items-center gap-1 text-xs text-green-700 hover:text-green-900 font-medium border border-green-300 rounded-lg px-3 py-1.5 bg-white hover:bg-green-50 transition-colors"
            >
              ⇄ Central de Conversão
            </a>
          </div>
        </div>
      )}

      {/* Info banner */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border text-xs text-muted-foreground">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <p>
          Grãos em <strong>USX/bu</strong> (centavos de dólar por bushel) · Algodão em <strong>USX/lb</strong> (centavos por libra) · Pecuária em <strong>USX/cwt</strong> (centavos por hundredweight).
          Para converter em USD, divida por 100. Cotações atualizadas automaticamente a cada 30 minutos.
        </p>
      </div>

      {/* Quote Cards por grupo */}
      {loadingQuotes ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="h-44 animate-pulse bg-muted/30" />
          ))}
        </div>
      ) : quotes.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          <p>Nenhuma cotação disponível. Clique em "Atualizar" para buscar os dados.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {GROUPS.map((group) => {
            const groupQuotes = quotes.filter((q) => group.symbols.includes(q.symbol));
            if (groupQuotes.length === 0) return null;
            return (
              <div key={group.label}>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  {group.label}
                </h2>
                <div className={`grid grid-cols-1 gap-4 ${
                  groupQuotes.length === 1 ? "md:grid-cols-1 max-w-sm" :
                  groupQuotes.length === 2 ? "md:grid-cols-2" :
                  "md:grid-cols-3"
                }`}>
                  {groupQuotes.map((q) => (
                    <QuoteCard key={q.symbol} quote={q} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Gráficos históricos por grupo - requer plano Essencial */}
      <PaywallGate
        minPlan="morning_call"
        featureName="Histórico de Preços"
        description="Acesse gráficos históricos interativos de 1 mês a 1 ano para todas as commodities, com tabela de referência completa."
      >
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">Histórico de Preços</h2>
        <Tabs value={range} onValueChange={(v) => setRange(v as RangeOption)}>
          <TabsList className="h-8">
            {(Object.keys(RANGE_LABELS) as RangeOption[]).map((r) => (
              <TabsTrigger key={r} value={r} className="text-xs px-3 h-7">
                {RANGE_LABELS[r]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {isLoadingHistory ? (
        <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" />
          Carregando histórico...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {GROUPS.map((group) => {
            const groupQuotes = quotes.filter((q) => group.symbols.includes(q.symbol));
            if (groupQuotes.length === 0) return null;
            return (
              <Card key={group.label} className="shadow-md border-0">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    {group.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <GroupChart
                    symbols={group.symbols}
                    histories={histories}
                    quotes={quotes}
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Tabela de conversão completa */}
      {quotes.length > 0 && (
        <Card className="shadow-md border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Tabela de Conversão — Mercado Brasileiro</CardTitle>
            <p className="text-xs text-muted-foreground">
              Câmbio USD/BRL: R$ {(quotes[0]?.usdBrl ?? 5.80).toFixed(4)} · Grãos: R$/saca (60kg) · Pecuária e Algodão: R$/arroba (15kg)
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-xs">
                    <th className="text-left py-2 font-medium">Commodity</th>
                    <th className="text-right py-2 font-medium">Cotação (USX)</th>
                    <th className="text-right py-2 font-medium">USD/unid.</th>
                    <th className="text-right py-2 font-medium text-green-700">R$/saca ou R$/@</th>
                    <th className="text-right py-2 font-medium text-green-700">R$/tonelada</th>
                    <th className="text-right py-2 font-medium text-green-700">R$/kg</th>
                    <th className="text-right py-2 font-medium">Var. %</th>
                  </tr>
                </thead>
                <tbody>
                  {quotes.map((q) => {
                    const isUp = q.change > 0;
                    const isDown = q.change < 0;
                    const mainBrl = q.brlPriceSaca ?? q.brlPriceArroba;
                    const usdPerUnit = q.price / 100;
                    return (
                      <tr key={q.symbol} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <span>{q.flag}</span>
                            <div>
                              <p className="font-medium">{q.name}</p>
                              <p className="text-xs text-muted-foreground">{q.unit} · {q.exchange}</p>
                            </div>
                          </div>
                        </td>
                        <td className="text-right font-mono font-semibold">
                          {q.price.toFixed(2)} ¢
                        </td>
                        <td className="text-right font-mono text-muted-foreground">
                          US$ {usdPerUnit.toFixed(4)}
                        </td>
                        <td className="text-right font-mono font-semibold text-green-700">
                          {mainBrl != null
                            ? `R$ ${mainBrl.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : "—"}
                        </td>
                        <td className="text-right font-mono text-green-700">
                          {q.brlPriceTon != null
                            ? `R$ ${q.brlPriceTon.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : "—"}
                        </td>
                        <td className="text-right font-mono text-green-700">
                          {q.brlPriceKg != null
                            ? `R$ ${q.brlPriceKg.toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`
                            : "—"}
                        </td>
                        <td className={`text-right font-mono font-medium ${isUp ? "text-green-600" : isDown ? "text-red-600" : ""}`}>
                          {isUp ? "+" : ""}{q.changePct.toFixed(2)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-3 p-3 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-800">
              <strong>⚠️ Nota sobre Pecuária:</strong> Os contratos CME (LE=F e GF=F) são cotados em USX/cwt (centavos/100 lbs) e refletem o mercado americano. A conversão para R$/@ é uma <strong>referência de paridade internacional</strong>, não o preço spot do boi gordo brasileiro (CEPEA/B3), que é formado por fatores locais e tipicamente está em torno de R$ 300–380/@. Para o preço spot nacional, consulte CEPEA ou B3.
            </div>
          </CardContent>
        </Card>
      )}
      </PaywallGate>
    </div>
  );
}
