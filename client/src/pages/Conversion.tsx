import { useState, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Calculator,
  ChevronDown,
  ChevronUp,
  Copy,
  RefreshCw,
  Info,
  TrendingUp,
  Globe,
  MapPin,
} from "lucide-react";
import {
  convertAll,
  COMMODITY_CONFIGS,
  type CommodityKey,
  type InputUnit,
  type Currency,
  type ConversionLine,
  type ConversionResult,
} from "@/lib/conversionEngine";

// ─── Helpers de formatação ────────────────────────────────────────────────────
function fmtValue(value: number, currency: Currency, decimals?: number): string {
  const d = decimals ?? (value < 1 ? 6 : value < 10 ? 4 : 2);
  const symbol = currency === "BRL" ? "R$" : "US$";
  return `${symbol} ${value.toLocaleString("pt-BR", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })}`;
}

// ─── Componente de linha de resultado ────────────────────────────────────────
function ResultLine({ line }: { line: ConversionLine }) {
  const decimals = line.value < 1 ? 6 : line.value < 10 ? 4 : 2;
  return (
    <div
      className={`flex items-center justify-between py-2.5 px-3 rounded-lg transition-colors ${
        line.isPrimary
          ? "bg-primary/10 border border-primary/30"
          : "bg-muted/30 hover:bg-muted/50"
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className={`text-xs font-medium ${line.isPrimary ? "text-primary" : "text-muted-foreground"}`}>
          {line.label}
        </p>
        {line.observation && (
          <p className="text-xs text-muted-foreground/70 truncate">{line.observation}</p>
        )}
      </div>
      <div className="text-right ml-3 flex-shrink-0">
        <p className={`font-mono font-bold text-sm ${line.isPrimary ? "text-primary" : "text-foreground"}`}>
          {fmtValue(line.value, line.currency, decimals)}
        </p>
      </div>
    </div>
  );
}

// ─── Painel de resultados (Brasil ou Internacional) ───────────────────────────
function ResultPanel({
  title,
  icon: Icon,
  lines,
  accentClass,
}: {
  title: string;
  icon: React.ElementType;
  lines: ConversionLine[];
  accentClass: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className={`flex items-center gap-2 pb-1 border-b ${accentClass}`}>
        <Icon className="w-4 h-4" />
        <span className="text-sm font-semibold">{title}</span>
      </div>
      {lines.length === 0 ? (
        <p className="text-xs text-muted-foreground italic py-2">Nenhuma conversão disponível</p>
      ) : (
        lines.map((line) => <ResultLine key={line.unitCode} line={line} />)
      )}
    </div>
  );
}

// ─── Memória de cálculo ───────────────────────────────────────────────────────
function CalcMemory({ steps, inputSummary }: { steps: string[]; inputSummary: string }) {
  const [open, setOpen] = useState(false);

  const copyCalc = () => {
    const text = [`Entrada: ${inputSummary}`, ...steps].join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Cálculo copiado!");
  };

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-sm font-medium"
      >
        <span className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-muted-foreground" />
          Ver cálculo detalhado
        </span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && (
        <div className="px-4 py-3 bg-muted/10 space-y-1">
          {steps.map((step, i) => (
            <p key={i} className="text-xs font-mono text-foreground/80 leading-relaxed">
              {step}
            </p>
          ))}
          <div className="pt-2">
            <Button size="sm" variant="outline" onClick={copyCalc} className="gap-1.5 text-xs h-7">
              <Copy className="w-3 h-3" /> Copiar cálculo
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Painel de referência Brasil × Internacional ──────────────────────────────
function ReferencePanel() {
  return (
    <Card className="border border-border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Info className="w-4 h-4 text-muted-foreground" />
          Padrões de Mercado
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <p className="font-semibold text-green-700 mb-1.5 flex items-center gap-1">
              <MapPin className="w-3 h-3" /> Padrão Brasil
            </p>
            <ul className="space-y-1 text-muted-foreground">
              <li>🌱 Soja — saca 60kg</li>
              <li>🌽 Milho — saca 60kg</li>
              <li>🌾 Trigo — saca 60kg</li>
              <li>☕ Café — saca 60kg</li>
              <li>🍬 Açúcar — saca 50kg</li>
              <li>🪡 Algodão — arroba 15kg</li>
              <li>🐄 Boi Gordo — arroba 15kg</li>
              <li>🎋 Cana — tonelada</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-blue-700 mb-1.5 flex items-center gap-1">
              <Globe className="w-3 h-3" /> Padrão Internacional
            </p>
            <ul className="space-y-1 text-muted-foreground">
              <li>🌱 Soja — bushel (CBOT)</li>
              <li>🌽 Milho — bushel (CBOT)</li>
              <li>🌾 Trigo — bushel (CBOT)</li>
              <li>☕ Café — libra (ICE)</li>
              <li>🍬 Açúcar — libra (ICE)</li>
              <li>🪡 Algodão — libra (ICE)</li>
              <li>🐄 Boi — cwt (CME)</li>
              <li>🎋 Cana — tonelada</li>
            </ul>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground space-y-0.5">
          <p><strong>1 bushel soja/trigo</strong> = 27,216 kg</p>
          <p><strong>1 bushel milho</strong> = 25,401 kg</p>
          <p><strong>1 libra</strong> = 0,453592 kg</p>
          <p><strong>1 arroba</strong> = 15 kg</p>
          <p><strong>1 cwt</strong> = 45,3592 kg</p>
          <p><strong>1 contrato B3 boi</strong> = 330 arrobas</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function Conversion() {
  // Buscar câmbio ao vivo das cotações existentes
  const { data: quotes } = trpc.commodities.quotes.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  const liveUsdBrl = quotes?.[0]?.usdBrl ?? 5.80;

  // Estado do formulário
  const [commodityKey, setCommodityKey] = useState<CommodityKey>("soja");
  const [inputValue, setInputValue] = useState("130");
  const [inputUnit, setInputUnit] = useState<InputUnit>("saca");
  const [inputCurrency, setInputCurrency] = useState<Currency>("BRL");
  const [usdBrl, setUsdBrl] = useState<string>("");
  const [atr, setAtr] = useState("140");

  const config = COMMODITY_CONFIGS.find((c) => c.key === commodityKey)!;

  // Câmbio efetivo: campo manual ou ao vivo
  const effectiveUsdBrl = useMemo(() => {
    const manual = parseFloat(usdBrl.replace(",", "."));
    return !isNaN(manual) && manual > 0 ? manual : liveUsdBrl;
  }, [usdBrl, liveUsdBrl]);

  // Sincronizar unidade ao trocar commodity
  const handleCommodityChange = useCallback((key: CommodityKey) => {
    const cfg = COMMODITY_CONFIGS.find((c) => c.key === key)!;
    setCommodityKey(key);
    setInputUnit(cfg.defaultUnit);
    setInputValue(String(cfg.defaultValue));
    setInputCurrency(cfg.defaultCurrency);
  }, []);

  // Calcular resultado
  const result: ConversionResult | null = useMemo(() => {
    const val = parseFloat(inputValue.replace(",", "."));
    if (isNaN(val) || val <= 0) return null;
    try {
      return convertAll({
        commodity: commodityKey,
        value: val,
        unit: inputUnit,
        currency: inputCurrency,
        usdBrl: effectiveUsdBrl,
        atr: commodityKey === "cana" ? parseFloat(atr.replace(",", ".")) || undefined : undefined,
      });
    } catch {
      return null;
    }
  }, [commodityKey, inputValue, inputUnit, inputCurrency, effectiveUsdBrl, atr]);

  const copyAll = () => {
    if (!result) return;
    const lines = [
      `Central de Conversão — ${config.label}`,
      `Entrada: ${result.inputSummary}`,
      `Câmbio: R$ ${effectiveUsdBrl.toFixed(4)}`,
      "",
      "=== Padrão Brasil ===",
      ...result.brasil.map((l) => `${l.label}: ${fmtValue(l.value, l.currency)}`),
      "",
      "=== Padrão Internacional ===",
      ...result.internacional.map((l) => `${l.label}: ${fmtValue(l.value, l.currency)}`),
    ].join("\n");
    navigator.clipboard.writeText(lines);
    toast.success("Conversão copiada!");
  };

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Calculator className="w-6 h-6 text-primary" />
          Central de Conversão de Commodities
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Converta preços entre unidades brasileiras e internacionais em tempo real. Digite qualquer valor em qualquer unidade.
        </p>
      </div>

      {/* Câmbio ao vivo */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2 w-fit">
        <TrendingUp className="w-3.5 h-3.5 text-green-600" />
        <span>
          Câmbio ao vivo:{" "}
          <strong className="text-foreground">
            USD/BRL = R$ {liveUsdBrl.toFixed(4)}
          </strong>
        </span>
        <span className="text-muted-foreground/50">·</span>
        <span>Você pode sobrescrever no campo abaixo</span>
      </div>

      {/* Layout 3 colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Coluna 1: Entrada */}
        <Card className="border border-border shadow-sm lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <span className="text-lg">{config.flag}</span>
              Entrada
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Commodity */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Commodity</Label>
              <Select value={commodityKey} onValueChange={(v) => handleCommodityChange(v as CommodityKey)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMMODITY_CONFIGS.map((c) => (
                    <SelectItem key={c.key} value={c.key}>
                      {c.flag} {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Valor */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Preço</Label>
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="h-9 text-sm font-mono"
                placeholder="Ex: 130,00"
                inputMode="decimal"
              />
            </div>

            {/* Unidade */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Unidade</Label>
              <Select value={inputUnit} onValueChange={(v) => setInputUnit(v as InputUnit)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {config.availableUnits.map((u) => (
                    <SelectItem key={u.value} value={u.value}>
                      {u.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Moeda */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Moeda</Label>
              <Select value={inputCurrency} onValueChange={(v) => setInputCurrency(v as Currency)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRL">🇧🇷 BRL — Real</SelectItem>
                  <SelectItem value="USD">🇺🇸 USD — Dólar</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Câmbio manual */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Câmbio USD/BRL{" "}
                <span className="text-muted-foreground font-normal">(opcional — sobrescreve o automático)</span>
              </Label>
              <div className="relative">
                <Input
                  value={usdBrl}
                  onChange={(e) => setUsdBrl(e.target.value)}
                  className="h-9 text-sm font-mono"
                  placeholder={`${liveUsdBrl.toFixed(4)} (ao vivo)`}
                  inputMode="decimal"
                />
                {usdBrl && (
                  <button
                    onClick={() => setUsdBrl("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* ATR (apenas cana) */}
            {commodityKey === "cana" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  ATR{" "}
                  <span className="text-muted-foreground font-normal">(kg de açúcar/tonelada)</span>
                </Label>
                <Input
                  value={atr}
                  onChange={(e) => setAtr(e.target.value)}
                  className="h-9 text-sm font-mono"
                  placeholder="Ex: 140"
                  inputMode="decimal"
                />
              </div>
            )}

            {/* Nota da commodity */}
            {config.note && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-800">
                <strong>⚠️</strong> {config.note}
              </div>
            )}

            {/* Câmbio efetivo */}
            <div className="pt-1 border-t border-border text-xs text-muted-foreground">
              Câmbio utilizado:{" "}
              <strong className="text-foreground">
                R$ {effectiveUsdBrl.toFixed(4)}
              </strong>
              {usdBrl ? (
                <Badge variant="outline" className="ml-1 text-xs py-0 h-4">manual</Badge>
              ) : (
                <Badge variant="outline" className="ml-1 text-xs py-0 h-4 text-green-700 border-green-300">ao vivo</Badge>
              )}
            </div>

            {/* Botão copiar tudo */}
            {result && (
              <Button
                size="sm"
                variant="outline"
                onClick={copyAll}
                className="w-full gap-1.5 text-xs"
              >
                <Copy className="w-3.5 h-3.5" /> Copiar todas as conversões
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Colunas 2 e 3: Resultados */}
        <div className="lg:col-span-2 space-y-4">
          {result ? (
            <>
              {/* Resumo da entrada */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
                <p className="text-xs text-muted-foreground">Convertendo</p>
                <p className="font-semibold text-foreground text-sm mt-0.5">
                  {config.flag} {config.label} — {result.inputSummary}
                </p>
              </div>

              {/* Grid de resultados */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Brasil */}
                <Card className="border border-green-200 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-green-700 flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Padrão Brasil
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResultPanel
                      title=""
                      icon={MapPin}
                      lines={result.brasil}
                      accentClass="border-green-200 text-green-700"
                    />
                  </CardContent>
                </Card>

                {/* Internacional */}
                <Card className="border border-blue-200 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-blue-700 flex items-center gap-2">
                      <Globe className="w-4 h-4" />
                      Padrão Internacional
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResultPanel
                      title=""
                      icon={Globe}
                      lines={result.internacional}
                      accentClass="border-blue-200 text-blue-700"
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Memória de cálculo */}
              <CalcMemory steps={result.memoriaCalculo} inputSummary={result.inputSummary} />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-center gap-3 text-muted-foreground">
              <Calculator className="w-10 h-10 opacity-30" />
              <p className="text-sm">
                Informe um valor válido no painel de entrada para ver as conversões.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Painel de referência */}
      <ReferencePanel />
    </div>
  );
}
