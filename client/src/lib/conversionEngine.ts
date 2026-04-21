/**
 * conversionEngine.ts
 * Motor puro de conversão de unidades para commodities agrícolas.
 * Roda 100% no frontend — sem chamadas ao backend.
 * Lógica: entrada → kg-base → todas as saídas.
 */

// ─── Fatores físicos ──────────────────────────────────────────────────────────
export const PHYSICAL = {
  soja:    { kgPerBushel: 27.216, kgPerSaca: 60,  kgPerTon: 1000 },
  milho:   { kgPerBushel: 25.401, kgPerSaca: 60,  kgPerTon: 1000 },
  trigo:   { kgPerBushel: 27.216, kgPerSaca: 60,  kgPerTon: 1000 },
  cafe:    { kgPerLibra:  0.453592, kgPerSaca: 60, kgPerTon: 1000 },
  algodao: { kgPerLibra:  0.453592, kgPerArroba: 15, kgPerTon: 1000 },
  boi:     { kgPerArroba: 15, kgPerCwt: 45.3592, kgPerTon: 1000, arrobasPorContrato: 330 },
  cana:    { kgPerTon: 1000 },
  acucar:  { kgPerLibra: 0.453592, kgPerSaca: 50, kgPerTon: 1000 },
} as const;

export type CommodityKey = keyof typeof PHYSICAL;

export type InputUnit =
  | "saca"
  | "ton"
  | "kg"
  | "bushel"
  | "libra"
  | "arroba"
  | "cwt";

export type Currency = "BRL" | "USD";

export interface ConversionInput {
  commodity: CommodityKey;
  value: number;
  unit: InputUnit;
  currency: Currency;
  usdBrl: number;
  atr?: number; // ATR por tonelada — apenas cana
}

export interface ConversionLine {
  unit: string;
  unitCode: string;
  value: number;
  currency: Currency;
  label: string;        // ex: "R$/saca (60kg)"
  formula: string;      // memória de cálculo passo a passo
  observation: string;  // "Padrão Brasil", "Padrão CBOT", etc.
  isPrimary: boolean;   // destaque visual
  isBrazil: boolean;    // true = coluna Brasil, false = coluna Internacional
}

export interface ConversionResult {
  pricePerKgBrl: number;
  brasil: ConversionLine[];
  internacional: ConversionLine[];
  memoriaCalculo: string[];
  inputSummary: string; // "R$ 130,00 por saca (60kg)"
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number, decimals = 2): string {
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtCurrency(n: number, currency: Currency, decimals = 2): string {
  const symbol = currency === "BRL" ? "R$" : "US$";
  return `${symbol} ${fmt(n, decimals)}`;
}

/** Converte o valor de entrada para BRL/kg (unidade-base interna) */
function toPricePerKgBrl(input: ConversionInput): { pricePerKgBrl: number; pricePerKgUsd: number } {
  const { commodity, value, unit, currency, usdBrl } = input;
  const p = PHYSICAL[commodity] as Record<string, number>;

  let kgEquiv: number;
  switch (unit) {
    case "saca":    kgEquiv = p.kgPerSaca ?? 60; break;
    case "ton":     kgEquiv = 1000; break;
    case "kg":      kgEquiv = 1; break;
    case "bushel":  kgEquiv = p.kgPerBushel ?? 27.216; break;
    case "libra":   kgEquiv = p.kgPerLibra ?? 0.453592; break;
    case "arroba":  kgEquiv = p.kgPerArroba ?? 15; break;
    case "cwt":     kgEquiv = p.kgPerCwt ?? 45.3592; break;
    default:        kgEquiv = 1;
  }

  // Preço por kg na moeda de entrada
  const pricePerKgInput = value / kgEquiv;
  // Converter para BRL
  const pricePerKgBrl = currency === "BRL" ? pricePerKgInput : pricePerKgInput * usdBrl;
  const pricePerKgUsd = currency === "USD" ? pricePerKgInput : pricePerKgInput / usdBrl;

  return { pricePerKgBrl, pricePerKgUsd };
}

function unitLabel(unit: InputUnit, commodity: CommodityKey): string {
  const p = PHYSICAL[commodity] as Record<string, number>;
  switch (unit) {
    case "saca":   return `saca (${p.kgPerSaca ?? 60}kg)`;
    case "ton":    return "tonelada (1.000kg)";
    case "kg":     return "kg";
    case "bushel": return `bushel (${p.kgPerBushel ?? 27.216}kg)`;
    case "libra":  return `libra (${p.kgPerLibra ?? 0.453592}kg)`;
    case "arroba": return `arroba (${p.kgPerArroba ?? 15}kg)`;
    case "cwt":    return `cwt (${p.kgPerCwt ?? 45.3592}kg)`;
    default:       return unit;
  }
}

// ─── Motor principal ──────────────────────────────────────────────────────────
export function convertAll(input: ConversionInput): ConversionResult {
  const { commodity, value, unit, currency, usdBrl, atr } = input;
  const p = PHYSICAL[commodity] as Record<string, number>;
  const { pricePerKgBrl, pricePerKgUsd } = toPricePerKgBrl(input);

  const brasil: ConversionLine[] = [];
  const internacional: ConversionLine[] = [];
  const mem: string[] = [];

  const inputUnitLabel = unitLabel(unit, commodity);
  const inputCurrencySymbol = currency === "BRL" ? "R$" : "US$";

  mem.push(`Entrada: ${inputCurrencySymbol} ${fmt(value)} por ${inputUnitLabel}`);
  mem.push(`Câmbio USD/BRL: R$ ${fmt(usdBrl, 4)}`);

  // Etapa 1: normalização para kg-base
  const kgEquivInput = (() => {
    switch (unit) {
      case "saca":   return p.kgPerSaca ?? 60;
      case "ton":    return 1000;
      case "kg":     return 1;
      case "bushel": return p.kgPerBushel ?? 27.216;
      case "libra":  return p.kgPerLibra ?? 0.453592;
      case "arroba": return p.kgPerArroba ?? 15;
      case "cwt":    return p.kgPerCwt ?? 45.3592;
      default:       return 1;
    }
  })();

  mem.push(`Passo 1 — Normalizar: ${fmt(value)} ÷ ${fmt(kgEquivInput, 6)} = R$ ${fmt(pricePerKgBrl, 6)}/kg`);
  mem.push(`Passo 2 — Base BRL/kg = R$ ${fmt(pricePerKgBrl, 6)}`);

  // ─── Grãos: soja, milho, trigo ───────────────────────────────────────────
  if (commodity === "soja" || commodity === "milho" || commodity === "trigo") {
    const kgSaca = p.kgPerSaca;
    const kgBushel = p.kgPerBushel;

    const brlSaca   = pricePerKgBrl * kgSaca;
    const brlTon    = pricePerKgBrl * 1000;
    const brlKg     = pricePerKgBrl;
    const brlBushel = pricePerKgBrl * kgBushel;
    const usdBushel = pricePerKgUsd * kgBushel;
    const usdTon    = pricePerKgUsd * 1000;

    brasil.push({ unit: "R$/saca", unitCode: "saca", value: brlSaca, currency: "BRL", label: `R$/saca (${kgSaca}kg)`, formula: `R$ ${fmt(pricePerKgBrl, 6)}/kg × ${kgSaca}kg`, observation: "Padrão Brasil", isPrimary: true, isBrazil: true });
    brasil.push({ unit: "R$/tonelada", unitCode: "ton", value: brlTon, currency: "BRL", label: "R$/tonelada", formula: `R$ ${fmt(pricePerKgBrl, 6)}/kg × 1.000kg`, observation: `${fmt(1000 / kgSaca, 2)} sacas`, isPrimary: false, isBrazil: true });
    brasil.push({ unit: "R$/kg", unitCode: "kg", value: brlKg, currency: "BRL", label: "R$/kg", formula: `base direta`, observation: "valor unitário", isPrimary: false, isBrazil: true });
    brasil.push({ unit: "R$/bushel", unitCode: "bushel", value: brlBushel, currency: "BRL", label: `R$/bushel (${kgBushel}kg)`, formula: `R$ ${fmt(pricePerKgBrl, 6)}/kg × ${kgBushel}kg`, observation: "referência CBOT em BRL", isPrimary: false, isBrazil: true });

    internacional.push({ unit: "US$/bushel", unitCode: "bushel", value: usdBushel, currency: "USD", label: `US$/bushel (${kgBushel}kg)`, formula: `R$ ${fmt(brlBushel, 4)} ÷ ${fmt(usdBrl, 4)} = US$ ${fmt(usdBushel, 4)}`, observation: "Padrão CBOT", isPrimary: true, isBrazil: false });
    internacional.push({ unit: "US$/tonelada", unitCode: "ton", value: usdTon, currency: "USD", label: "US$/tonelada", formula: `R$ ${fmt(brlTon, 2)} ÷ ${fmt(usdBrl, 4)}`, observation: "referência internacional", isPrimary: false, isBrazil: false });
    internacional.push({ unit: "USX/bushel", unitCode: "bushel_usx", value: usdBushel * 100, currency: "USD", label: "USX/bushel (centavos)", formula: `US$ ${fmt(usdBushel, 4)} × 100`, observation: "cotação CBOT em centavos", isPrimary: false, isBrazil: false });

    mem.push(`Passo 3 — R$/saca: R$ ${fmt(pricePerKgBrl, 6)} × ${kgSaca} = R$ ${fmt(brlSaca, 2)}`);
    mem.push(`Passo 4 — R$/bushel: R$ ${fmt(pricePerKgBrl, 6)} × ${kgBushel} = R$ ${fmt(brlBushel, 4)}`);
    mem.push(`Passo 5 — US$/bushel: R$ ${fmt(brlBushel, 4)} ÷ ${fmt(usdBrl, 4)} = US$ ${fmt(usdBushel, 4)}`);
  }

  // ─── Café e Açúcar: cotados em USX/lb ────────────────────────────────────
  else if (commodity === "cafe" || commodity === "acucar") {
    const kgSaca  = p.kgPerSaca;
    const kgLibra = p.kgPerLibra;

    const brlSaca  = pricePerKgBrl * kgSaca;
    const brlTon   = pricePerKgBrl * 1000;
    const brlKg    = pricePerKgBrl;
    const brlLibra = pricePerKgBrl * kgLibra;
    const usdLibra = pricePerKgUsd * kgLibra;
    const usdSaca  = pricePerKgUsd * kgSaca;

    brasil.push({ unit: "R$/saca", unitCode: "saca", value: brlSaca, currency: "BRL", label: `R$/saca (${kgSaca}kg)`, formula: `R$ ${fmt(pricePerKgBrl, 6)}/kg × ${kgSaca}kg`, observation: "Padrão Brasil", isPrimary: true, isBrazil: true });
    brasil.push({ unit: "R$/tonelada", unitCode: "ton", value: brlTon, currency: "BRL", label: "R$/tonelada", formula: `R$ ${fmt(pricePerKgBrl, 6)}/kg × 1.000kg`, observation: `${fmt(1000 / kgSaca, 2)} sacas`, isPrimary: false, isBrazil: true });
    brasil.push({ unit: "R$/kg", unitCode: "kg", value: brlKg, currency: "BRL", label: "R$/kg", formula: "base direta", observation: "valor unitário", isPrimary: false, isBrazil: true });
    brasil.push({ unit: "R$/libra", unitCode: "libra", value: brlLibra, currency: "BRL", label: `R$/libra (${kgLibra}kg)`, formula: `R$ ${fmt(pricePerKgBrl, 6)}/kg × ${kgLibra}kg`, observation: "referência ICE em BRL", isPrimary: false, isBrazil: true });

    internacional.push({ unit: "US$/libra", unitCode: "libra", value: usdLibra, currency: "USD", label: `US$/libra (${kgLibra}kg)`, formula: `R$ ${fmt(brlLibra, 4)} ÷ ${fmt(usdBrl, 4)}`, observation: "Padrão ICE", isPrimary: true, isBrazil: false });
    internacional.push({ unit: "USX/libra", unitCode: "libra_usx", value: usdLibra * 100, currency: "USD", label: "USX/libra (centavos)", formula: `US$ ${fmt(usdLibra, 4)} × 100`, observation: "cotação ICE em centavos", isPrimary: false, isBrazil: false });
    internacional.push({ unit: "US$/saca", unitCode: "saca_usd", value: usdSaca, currency: "USD", label: `US$/saca (${kgSaca}kg)`, formula: `US$ ${fmt(pricePerKgUsd, 6)}/kg × ${kgSaca}kg`, observation: "referência exportação", isPrimary: false, isBrazil: false });

    mem.push(`Passo 3 — R$/saca: R$ ${fmt(pricePerKgBrl, 6)} × ${kgSaca} = R$ ${fmt(brlSaca, 2)}`);
    mem.push(`Passo 4 — R$/libra: R$ ${fmt(pricePerKgBrl, 6)} × ${fmt(kgLibra, 6)} = R$ ${fmt(brlLibra, 4)}`);
    mem.push(`Passo 5 — US$/libra: R$ ${fmt(brlLibra, 4)} ÷ ${fmt(usdBrl, 4)} = US$ ${fmt(usdLibra, 4)}`);
  }

  // ─── Algodão: USX/lb; unidade BR = arroba ────────────────────────────────
  else if (commodity === "algodao") {
    const kgArroba = p.kgPerArroba;
    const kgLibra  = p.kgPerLibra;

    const brlArroba = pricePerKgBrl * kgArroba;
    const brlTon    = pricePerKgBrl * 1000;
    const brlKg     = pricePerKgBrl;
    const brlLibra  = pricePerKgBrl * kgLibra;
    const usdLibra  = pricePerKgUsd * kgLibra;
    const usdTon    = pricePerKgUsd * 1000;

    brasil.push({ unit: "R$/arroba", unitCode: "arroba", value: brlArroba, currency: "BRL", label: `R$/arroba (${kgArroba}kg)`, formula: `R$ ${fmt(pricePerKgBrl, 6)}/kg × ${kgArroba}kg`, observation: "Padrão Brasil", isPrimary: true, isBrazil: true });
    brasil.push({ unit: "R$/tonelada", unitCode: "ton", value: brlTon, currency: "BRL", label: "R$/tonelada", formula: `R$ ${fmt(pricePerKgBrl, 6)}/kg × 1.000kg`, observation: `${fmt(1000 / kgArroba, 2)} arrobas`, isPrimary: false, isBrazil: true });
    brasil.push({ unit: "R$/kg", unitCode: "kg", value: brlKg, currency: "BRL", label: "R$/kg", formula: "base direta", observation: "valor unitário", isPrimary: false, isBrazil: true });
    brasil.push({ unit: "R$/libra", unitCode: "libra", value: brlLibra, currency: "BRL", label: `R$/libra (${kgLibra}kg)`, formula: `R$ ${fmt(pricePerKgBrl, 6)}/kg × ${fmt(kgLibra, 6)}kg`, observation: "referência ICE em BRL", isPrimary: false, isBrazil: true });

    internacional.push({ unit: "US$/libra", unitCode: "libra", value: usdLibra, currency: "USD", label: `US$/libra (${kgLibra}kg)`, formula: `R$ ${fmt(brlLibra, 4)} ÷ ${fmt(usdBrl, 4)}`, observation: "Padrão ICE", isPrimary: true, isBrazil: false });
    internacional.push({ unit: "USX/libra", unitCode: "libra_usx", value: usdLibra * 100, currency: "USD", label: "USX/libra (centavos)", formula: `US$ ${fmt(usdLibra, 4)} × 100`, observation: "cotação ICE em centavos", isPrimary: false, isBrazil: false });
    internacional.push({ unit: "US$/tonelada", unitCode: "ton", value: usdTon, currency: "USD", label: "US$/tonelada", formula: `R$ ${fmt(brlTon, 2)} ÷ ${fmt(usdBrl, 4)}`, observation: "referência exportação", isPrimary: false, isBrazil: false });

    mem.push(`Passo 3 — R$/arroba: R$ ${fmt(pricePerKgBrl, 6)} × ${kgArroba} = R$ ${fmt(brlArroba, 2)}`);
    mem.push(`Passo 4 — R$/libra: R$ ${fmt(pricePerKgBrl, 6)} × ${fmt(kgLibra, 6)} = R$ ${fmt(brlLibra, 4)}`);
    mem.push(`Passo 5 — US$/libra: R$ ${fmt(brlLibra, 4)} ÷ ${fmt(usdBrl, 4)} = US$ ${fmt(usdLibra, 4)}`);
  }

  // ─── Boi Gordo: unidade BR = arroba; CME = cwt ────────────────────────────
  else if (commodity === "boi") {
    const kgArroba = p.kgPerArroba;
    const kgCwt    = p.kgPerCwt;
    const arrobasContrato = p.arrobasPorContrato;

    const brlArroba   = pricePerKgBrl * kgArroba;
    const brlTon      = pricePerKgBrl * 1000;
    const brlKg       = pricePerKgBrl;
    const brlContrato = brlArroba * arrobasContrato;
    const usdCwt      = pricePerKgUsd * kgCwt;
    const usdArroba   = pricePerKgUsd * kgArroba;

    brasil.push({ unit: "R$/arroba", unitCode: "arroba", value: brlArroba, currency: "BRL", label: `R$/arroba (${kgArroba}kg)`, formula: `R$ ${fmt(pricePerKgBrl, 6)}/kg × ${kgArroba}kg`, observation: "Padrão Brasil (B3)", isPrimary: true, isBrazil: true });
    brasil.push({ unit: "R$/tonelada", unitCode: "ton", value: brlTon, currency: "BRL", label: "R$/tonelada", formula: `R$ ${fmt(pricePerKgBrl, 6)}/kg × 1.000kg`, observation: `${fmt(1000 / kgArroba, 2)} arrobas`, isPrimary: false, isBrazil: true });
    brasil.push({ unit: "R$/kg", unitCode: "kg", value: brlKg, currency: "BRL", label: "R$/kg", formula: "base direta", observation: "valor unitário", isPrimary: false, isBrazil: true });
    brasil.push({ unit: "R$/contrato B3", unitCode: "contrato", value: brlContrato, currency: "BRL", label: `R$/contrato B3 (${arrobasContrato}@)`, formula: `R$ ${fmt(brlArroba, 2)} × ${arrobasContrato} arrobas`, observation: "1 contrato B3 = 330 arrobas", isPrimary: false, isBrazil: true });

    internacional.push({ unit: "US$/cwt", unitCode: "cwt", value: usdCwt, currency: "USD", label: `US$/cwt (${kgCwt}kg)`, formula: `R$ ${fmt(pricePerKgBrl, 6)}/kg × ${kgCwt}kg ÷ ${fmt(usdBrl, 4)}`, observation: "Padrão CME (mercado americano)", isPrimary: true, isBrazil: false });
    internacional.push({ unit: "US$/arroba", unitCode: "arroba_usd", value: usdArroba, currency: "USD", label: `US$/arroba (${kgArroba}kg)`, formula: `R$ ${fmt(brlArroba, 2)} ÷ ${fmt(usdBrl, 4)}`, observation: "paridade internacional", isPrimary: false, isBrazil: false });

    mem.push(`Passo 3 — R$/arroba: R$ ${fmt(pricePerKgBrl, 6)} × ${kgArroba} = R$ ${fmt(brlArroba, 2)}`);
    mem.push(`Passo 4 — R$/contrato B3: R$ ${fmt(brlArroba, 2)} × ${arrobasContrato} = R$ ${fmt(brlContrato, 2)}`);
    mem.push(`⚠️ Nota: CME (LE=F/GF=F) reflete mercado americano. O spot brasileiro (B3/CEPEA) é formado por fatores locais.`);
  }

  // ─── Cana-de-açúcar ───────────────────────────────────────────────────────
  else if (commodity === "cana") {
    const brlTon = pricePerKgBrl * 1000;
    const brlKg  = pricePerKgBrl;

    brasil.push({ unit: "R$/tonelada", unitCode: "ton", value: brlTon, currency: "BRL", label: "R$/tonelada", formula: "base direta", observation: "Padrão Brasil", isPrimary: true, isBrazil: true });
    brasil.push({ unit: "R$/kg", unitCode: "kg", value: brlKg, currency: "BRL", label: "R$/kg", formula: `R$ ${fmt(brlTon, 2)} ÷ 1.000`, observation: "valor unitário", isPrimary: false, isBrazil: true });

    if (atr && atr > 0) {
      const brlPorKgAtr = brlTon / atr;
      const brlPorTonAtr = brlTon; // já é por tonelada
      brasil.push({ unit: "R$/kg ATR", unitCode: "kg_atr", value: brlPorKgAtr, currency: "BRL", label: "R$/kg de ATR", formula: `R$ ${fmt(brlTon, 2)} ÷ ${fmt(atr, 2)} kg ATR/ton`, observation: `ATR = ${fmt(atr, 2)} kg/ton`, isPrimary: false, isBrazil: true });
      mem.push(`ATR: ${fmt(atr, 2)} kg de açúcar por tonelada de cana`);
      mem.push(`R$/kg ATR: R$ ${fmt(brlTon, 2)} ÷ ${fmt(atr, 2)} = R$ ${fmt(brlPorKgAtr, 4)}`);
      void brlPorTonAtr;
    }

    internacional.push({ unit: "US$/tonelada", unitCode: "ton", value: pricePerKgUsd * 1000, currency: "USD", label: "US$/tonelada", formula: `R$ ${fmt(brlTon, 2)} ÷ ${fmt(usdBrl, 4)}`, observation: "referência internacional", isPrimary: true, isBrazil: false });

    mem.push(`Passo 3 — R$/tonelada: base direta = R$ ${fmt(brlTon, 2)}`);
  }

  const inputSummary = `${currency === "BRL" ? "R$" : "US$"} ${fmt(value)} por ${unitLabel(unit, commodity)}`;

  return {
    pricePerKgBrl,
    brasil,
    internacional,
    memoriaCalculo: mem,
    inputSummary,
  };
}

// ─── Configuração de commodities para o seletor ───────────────────────────────
export interface CommodityConfig {
  key: CommodityKey;
  label: string;
  flag: string;
  defaultUnit: InputUnit;
  defaultValue: number;
  defaultCurrency: Currency;
  availableUnits: { value: InputUnit; label: string }[];
  note?: string;
}

export const COMMODITY_CONFIGS: CommodityConfig[] = [
  {
    key: "soja",
    label: "Soja",
    flag: "🌱",
    defaultUnit: "saca",
    defaultValue: 130,
    defaultCurrency: "BRL",
    availableUnits: [
      { value: "saca", label: "Saca (60kg)" },
      { value: "ton", label: "Tonelada" },
      { value: "kg", label: "Kg" },
      { value: "bushel", label: "Bushel (27,216kg)" },
    ],
  },
  {
    key: "milho",
    label: "Milho",
    flag: "🌽",
    defaultUnit: "saca",
    defaultValue: 65,
    defaultCurrency: "BRL",
    availableUnits: [
      { value: "saca", label: "Saca (60kg)" },
      { value: "ton", label: "Tonelada" },
      { value: "kg", label: "Kg" },
      { value: "bushel", label: "Bushel (25,401kg)" },
    ],
  },
  {
    key: "trigo",
    label: "Trigo",
    flag: "🌾",
    defaultUnit: "saca",
    defaultValue: 90,
    defaultCurrency: "BRL",
    availableUnits: [
      { value: "saca", label: "Saca (60kg)" },
      { value: "ton", label: "Tonelada" },
      { value: "kg", label: "Kg" },
      { value: "bushel", label: "Bushel (27,216kg)" },
    ],
  },
  {
    key: "cafe",
    label: "Café Arábica",
    flag: "☕",
    defaultUnit: "saca",
    defaultValue: 1800,
    defaultCurrency: "BRL",
    availableUnits: [
      { value: "saca", label: "Saca (60kg)" },
      { value: "ton", label: "Tonelada" },
      { value: "kg", label: "Kg" },
      { value: "libra", label: "Libra (0,4536kg)" },
    ],
  },
  {
    key: "acucar",
    label: "Açúcar Bruto",
    flag: "🍬",
    defaultUnit: "saca",
    defaultValue: 140,
    defaultCurrency: "BRL",
    availableUnits: [
      { value: "saca", label: "Saca (50kg)" },
      { value: "ton", label: "Tonelada" },
      { value: "kg", label: "Kg" },
      { value: "libra", label: "Libra (0,4536kg)" },
    ],
  },
  {
    key: "algodao",
    label: "Algodão",
    flag: "🪡",
    defaultUnit: "arroba",
    defaultValue: 120,
    defaultCurrency: "BRL",
    availableUnits: [
      { value: "arroba", label: "Arroba (15kg)" },
      { value: "ton", label: "Tonelada" },
      { value: "kg", label: "Kg" },
      { value: "libra", label: "Libra (0,4536kg)" },
    ],
  },
  {
    key: "boi",
    label: "Boi Gordo",
    flag: "🐄",
    defaultUnit: "arroba",
    defaultValue: 340,
    defaultCurrency: "BRL",
    availableUnits: [
      { value: "arroba", label: "Arroba (15kg)" },
      { value: "ton", label: "Tonelada" },
      { value: "kg", label: "Kg" },
      { value: "cwt", label: "Cwt (45,36kg)" },
    ],
    note: "O preço spot brasileiro (B3/CEPEA) é formado por fatores locais e difere da paridade CME.",
  },
  {
    key: "cana",
    label: "Cana-de-açúcar",
    flag: "🎋",
    defaultUnit: "ton",
    defaultValue: 110,
    defaultCurrency: "BRL",
    availableUnits: [
      { value: "ton", label: "Tonelada" },
      { value: "kg", label: "Kg" },
    ],
    note: "Informe o ATR (kg de açúcar por tonelada) para calcular o valor por kg de ATR.",
  },
];
