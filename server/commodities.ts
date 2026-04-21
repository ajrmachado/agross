import { callDataApi } from "./_core/dataApi";
import { getDb } from "./db";
import { commodityPrices } from "../drizzle/schema";
import { desc, eq, gte, and } from "drizzle-orm";

// ─── Commodity definitions ────────────────────────────────────────────────────

// ─── Conversion constants ─────────────────────────────────────────────────────
// All prices from Yahoo Finance for grain futures come in USX (US cents) per bushel.
// Cattle comes in USX/cwt (hundredweight = 45.3592 kg).
// Cotton comes in USX/lb.

export const CONVERSION = {
  // Soja: 1 bu = 27.216 kg; 1 saca = 60 kg; 1 ton = 1000 kg
  soja: {
    buPerSaca:   60 / 27.216,       // 2.2046 bu/saca
    buPerTon:    1000 / 27.216,     // 36.7437 bu/ton
    sacaPerTon:  1000 / 60,         // 16.6667 saca/ton
    // USX/bu → BRL/saca: (price_usx / 100) * usdBrl * sacas_per_bu_inverse
    // = price_usx * (1/100) * usdBrl * (60/27.216)
    brlSacaFactor: (1 / 100) * (60 / 27.216), // multiply by usdBrl
    brlTonFactor:  (1 / 100) * (1000 / 27.216),
  },
  // Milho: 1 bu = 25.4 kg
  milho: {
    buPerSaca:   60 / 25.4,         // 2.3622
    buPerTon:    1000 / 25.4,       // 39.3701
    sacaPerTon:  1000 / 60,
    brlSacaFactor: (1 / 100) * (60 / 25.4),
    brlTonFactor:  (1 / 100) * (1000 / 25.4),
  },
  // Trigo: mesmas relações físicas da soja
  trigo: {
    buPerSaca:   60 / 27.216,
    buPerTon:    1000 / 27.216,
    sacaPerTon:  1000 / 60,
    brlSacaFactor: (1 / 100) * (60 / 27.216),
    brlTonFactor:  (1 / 100) * (1000 / 27.216),
  },
  // Algodão: USX/lb; 1 lb = 0.453592 kg; 1 @ = 15 kg; 1 ton = 1000 kg
  algodao: {
    lbPerArroba: 15 / 0.453592,     // 33.0693 lb/@
    lbPerTon:    1000 / 0.453592,   // 2204.6226 lb/ton
    arrobaPerTon: 1000 / 15,        // 66.6667 @/ton
    // USX/lb → BRL/@: (price_usx/100) * usdBrl * (15/0.453592)
    brlArrobaFactor: (1 / 100) * (15 / 0.453592),
    brlTonFactor:    (1 / 100) * (1000 / 0.453592),
  },
  // Café Arábica: USX/lb; 1 lb = 0.453592 kg; 1 saca = 60 kg; 1 ton = 1000 kg
  cafe: {
    lbPerSaca:   60 / 0.453592,       // 132.277 lb/saca
    lbPerTon:    1000 / 0.453592,     // 2204.62 lb/ton
    sacaPerTon:  1000 / 60,           // 16.6667 saca/ton
    // USX/lb → BRL/saca: (price_usx/100) * usdBrl * (60/0.453592)
    brlSacaFactor: (1 / 100) * (60 / 0.453592),
    brlTonFactor:  (1 / 100) * (1000 / 0.453592),
  },
  // Açúcar Bruto: USX/lb; mesmas relações físicas do café
  acucar: {
    lbPerSaca:   60 / 0.453592,
    lbPerTon:    1000 / 0.453592,
    sacaPerTon:  1000 / 60,
    // USX/lb → BRL/saca (50kg para açúcar)
    brlSacaFactor: (1 / 100) * (50 / 0.453592),
    brlTonFactor:  (1 / 100) * (1000 / 0.453592),
  },
  // Boi Gordo / Alimentado: USX/cwt; 1 cwt = 45.3592 kg; 1 @ = 15 kg
  boi: {
    cwtPerArroba: 15 / 45.3592,     // 0.3307 cwt/@
    arrobaPerCwt: 45.3592 / 15,     // 3.0239 @/cwt
    arrobaPerTon: 1000 / 15,        // 66.6667 @/ton
    // USX/cwt → BRL/@: (price_usx/100) * usdBrl * (15/45.3592)
    brlArrobaFactor: (1 / 100) * (15 / 45.3592),
    brlTonFactor:    (1 / 100) * (1000 / 45.3592),
  },
} as const;

export const COMMODITIES = [
  {
    symbol: "ZS=F", name: "Soja",           nameEn: "Soybeans",     unit: "USX/bu",  flag: "\uD83C\uDF31",
    brlUnit: "R$/saca",   brlFactor: CONVERSION.soja.brlSacaFactor,
    category: "graos",   convKey: "soja" as const,
  },
  {
    symbol: "ZC=F", name: "Milho",          nameEn: "Corn",         unit: "USX/bu",  flag: "\uD83C\uDF3D",
    brlUnit: "R$/saca",   brlFactor: CONVERSION.milho.brlSacaFactor,
    category: "graos",   convKey: "milho" as const,
  },
  {
    symbol: "ZW=F", name: "Trigo",          nameEn: "Wheat",        unit: "USX/bu",  flag: "\uD83C\uDF3E",
    brlUnit: "R$/saca",   brlFactor: CONVERSION.trigo.brlSacaFactor,
    category: "graos",   convKey: "trigo" as const,
  },
  {
    symbol: "CT=F", name: "Algod\u00e3o",        nameEn: "Cotton",       unit: "USX/lb",  flag: "\uD83E\uDEA1",
    brlUnit: "R$/arroba", brlFactor: CONVERSION.algodao.brlArrobaFactor,
    category: "fibras",  convKey: "algodao" as const,
  },
  {
    symbol: "LE=F", name: "Boi Gordo",      nameEn: "Live Cattle",  unit: "USX/cwt", flag: "\uD83D\uDC04",
    brlUnit: "R$/arroba", brlFactor: CONVERSION.boi.brlArrobaFactor,
    category: "pecuaria",convKey: "boi" as const,
  },
  {
    symbol: "GF=F", name: "Boi Alimentado", nameEn: "Feeder Cattle",unit: "USX/cwt", flag: "🐂",
    brlUnit: "R$/arroba", brlFactor: CONVERSION.boi.brlArrobaFactor,
    category: "pecuaria",convKey: "boi" as const,
  },
  {
    symbol: "KC=F", name: "Café Arábica",   nameEn: "Coffee Arabica",unit: "USX/lb",  flag: "☕",
    brlUnit: "R$/saca",   brlFactor: CONVERSION.cafe.brlSacaFactor,
    category: "outros",  convKey: "cafe" as const,
  },
  {
    symbol: "SB=F", name: "Açúcar Bruto",  nameEn: "Sugar Raw",    unit: "USX/lb",  flag: "🍬",
    brlUnit: "R$/saca",   brlFactor: CONVERSION.acucar.brlSacaFactor,
    category: "outros",  convKey: "acucar" as const,
  },
] as const;

export type CommoditySymbol = (typeof COMMODITIES)[number]["symbol"];

export type CommodityQuote = {
  symbol: string;
  name: string;
  nameEn: string;
  unit: string;
  flag: string;
  brlUnit: string;
  category: string;
  convKey: string;
  price: number;
  prevClose: number;
  change: number;
  changePct: number;
  currency: string;
  exchange: string;
  fetchedAt: Date;
  usdBrl?: number;        // taxa de câmbio USD/BRL no momento da coleta
  brlPrice?: number;      // preço na unidade principal BRL (saca ou arroba)
  brlPriceTon?: number;   // preço por tonelada em BRL
  // Grãos
  brlPriceSaca?: number;  // R$/saca (soja, milho, trigo)
  brlPriceBushel?: number;// USD/bushel (referência internacional)
  // Pecuária / Algodão
  brlPriceArroba?: number;// R$/@ (boi, algodão)
  brlPriceKg?: number;    // R$/kg
};

// ─── Exchange rate ────────────────────────────────────────────────────────────

/** Cached USD/BRL rate (refreshed every fetch cycle) */
let _cachedUsdBrl: { rate: number; fetchedAt: number } | null = null;

export async function fetchUsdBrl(): Promise<number> {
  // Return cached value if fresh (< 30 min)
  if (_cachedUsdBrl && Date.now() - _cachedUsdBrl.fetchedAt < 30 * 60 * 1000) {
    return _cachedUsdBrl.rate;
  }
  try {
    // USDBRL=X returns R$ per USD directly (e.g. 5.15 = 1 USD costs R$ 5.15)
    // BRL=X returns USD per BRL (inverted, ~0.20) — do NOT use that symbol
    const response = (await callDataApi("YahooFinance/get_stock_chart", {
      query: { symbol: "USDBRL=X", region: "US", interval: "1d", range: "5d" },
    })) as Record<string, unknown>;
    const chart = response?.chart as Record<string, unknown> | undefined;
    const results = chart?.result as Record<string, unknown>[] | undefined;
    if (!results || results.length === 0) throw new Error("No data");
    const meta = results[0].meta as Record<string, unknown>;
    const rate = Number(meta?.regularMarketPrice ?? 0);
    if (rate > 1) { // sanity check: R$/USD should always be > 1
      _cachedUsdBrl = { rate, fetchedAt: Date.now() };
      console.log(`[Commodities] USD/BRL rate: ${rate}`);
      return rate;
    }
  } catch (err) {
    console.error("[Commodities] Failed to fetch USD/BRL:", err);
  }
  // Fallback to last cached value or a conservative estimate
  return _cachedUsdBrl?.rate ?? 5.80;
}

// ─── Fetch from Yahoo Finance ─────────────────────────────────────────────────

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchQuote(symbol: string): Promise<{
  price: number;
  prevClose: number;
  change: number;
  changePct: number;
  currency: string;
  exchange: string;
} | null> {
  try {
    // Retry up to 3 times with exponential backoff
    let response: Record<string, unknown> | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        response = (await callDataApi("YahooFinance/get_stock_chart", {
          query: {
            symbol,
            region: "US",
            interval: "1d",
            range: "5d",
          },
        })) as Record<string, unknown>;
        break; // success
      } catch (retryErr) {
        if (attempt < 2) {
          await sleep(1000 * (attempt + 1));
        } else {
          throw retryErr;
        }
      }
    }
    if (!response) return null;

    const chart = response?.chart as Record<string, unknown> | undefined;
    const results = chart?.result as Record<string, unknown>[] | undefined;
    if (!results || results.length === 0) return null;

    const meta = results[0].meta as Record<string, unknown>;
    const price = Number(meta?.regularMarketPrice ?? 0);
    const prevClose = Number(
      meta?.chartPreviousClose ?? meta?.previousClose ?? 0
    );
    const change = price - prevClose;
    const changePct = prevClose ? (change / prevClose) * 100 : 0;
    const currency = String(meta?.currency ?? "USX");
    const exchange = String(meta?.exchangeName ?? "CBT");

    return {
      price: Math.round(price * 10000) / 10000,
      prevClose: Math.round(prevClose * 10000) / 10000,
      change: Math.round(change * 10000) / 10000,
      changePct: Math.round(changePct * 10000) / 10000,
      currency,
      exchange,
    };
  } catch (err) {
    console.error(`[Commodities] Error fetching ${symbol}:`, err);
    return null;
  }
}

/**
 * Fetch historical data for a single symbol (up to 1 year).
 * Returns array of { ts, close } sorted ascending.
 */
export async function fetchHistory(
  symbol: string,
  range: "1mo" | "3mo" | "6mo" | "1y" = "3mo"
): Promise<Array<{ ts: number; close: number }>> {
  try {
    const response = (await callDataApi("YahooFinance/get_stock_chart", {
      query: {
        symbol,
        region: "US",
        interval: "1d",
        range,
      },
    })) as Record<string, unknown>;

    const chart = response?.chart as Record<string, unknown> | undefined;
    const results = chart?.result as Record<string, unknown>[] | undefined;
    if (!results || results.length === 0) return [];

    const timestamps = results[0].timestamp as number[] | undefined;
    const indicators = results[0].indicators as Record<string, unknown> | undefined;
    const quote = (indicators?.quote as Record<string, unknown>[])?.[0];
    const closes = quote?.close as (number | null)[] | undefined;

    if (!timestamps || !closes) return [];

    return timestamps
      .map((ts, i) => ({
        ts: ts * 1000, // convert to ms
        close: closes[i] ?? 0,
      }))
      .filter((p) => p.close > 0);
  } catch (err) {
    console.error(`[Commodities] Error fetching history for ${symbol}:`, err);
    return [];
  }
}

// ─── Persist & retrieve ───────────────────────────────────────────────────────

/**
 * Fetch all three commodities and persist to DB.
 * Returns the fetched quotes.
 */
export async function fetchAndSaveAllQuotes(): Promise<CommodityQuote[]> {
  const db = await getDb();
  const quotes: CommodityQuote[] = [];

  // Fetch USD/BRL rate once for all commodities
  const usdBrl = await fetchUsdBrl();

  for (const commodity of COMMODITIES) {
    const data = await fetchQuote(commodity.symbol);
    if (!data) continue;

    // Calculate BRL price: USX/unit * factor * USD/BRL
    // factor converts USX per original unit to USD per kg, then to BRL per local unit
    const brlPrice = Math.round(data.price * commodity.brlFactor * usdBrl * 100) / 100;

    // Compute all BRL conversions
    const conv = CONVERSION[commodity.convKey];
    let brlPriceSaca: number | undefined;
    let brlPriceTon: number | undefined;
    let brlPriceArroba: number | undefined;
    let brlPriceKg: number | undefined;
    let brlPriceBushel: number | undefined;

    if (commodity.convKey === "soja" || commodity.convKey === "milho" || commodity.convKey === "trigo") {
      const c = conv as typeof CONVERSION.soja;
      brlPriceSaca = Math.round(data.price * c.brlSacaFactor * usdBrl * 100) / 100;
      brlPriceTon  = Math.round(data.price * c.brlTonFactor  * usdBrl * 100) / 100;
      brlPriceBushel = Math.round((data.price / 100) * usdBrl * 100) / 100; // USD/bu
      brlPriceKg   = Math.round(brlPriceTon / 1000 * 100) / 100;
    } else if (commodity.convKey === "algodao") {
      const c = conv as typeof CONVERSION.algodao;
      brlPriceArroba = Math.round(data.price * c.brlArrobaFactor * usdBrl * 100) / 100;
      brlPriceTon    = Math.round(data.price * c.brlTonFactor    * usdBrl * 100) / 100;
      brlPriceKg     = Math.round(brlPriceTon / 1000 * 100) / 100;
    } else if (commodity.convKey === "boi") {
      const c = conv as typeof CONVERSION.boi;
      brlPriceArroba = Math.round(data.price * c.brlArrobaFactor * usdBrl * 100) / 100;
      brlPriceTon    = Math.round(data.price * c.brlTonFactor    * usdBrl * 100) / 100;
      brlPriceKg     = Math.round(brlPriceTon / 1000 * 100) / 100;
    } else if (commodity.convKey === "cafe" || commodity.convKey === "acucar") {
      const c = conv as typeof CONVERSION.cafe;
      brlPriceSaca = Math.round(data.price * c.brlSacaFactor * usdBrl * 100) / 100;
      brlPriceTon  = Math.round(data.price * c.brlTonFactor  * usdBrl * 100) / 100;
      brlPriceKg   = Math.round(brlPriceTon / 1000 * 100) / 100;
    }

    const quote: CommodityQuote = {
      symbol: commodity.symbol,
      name: commodity.name,
      nameEn: commodity.nameEn,
      unit: commodity.unit,
      flag: commodity.flag,
      brlUnit: commodity.brlUnit,
      category: commodity.category,
      convKey: commodity.convKey,
      ...data,
      fetchedAt: new Date(),
      usdBrl,
      brlPrice,
      brlPriceSaca,
      brlPriceTon,
      brlPriceArroba,
      brlPriceKg,
      brlPriceBushel,
    };

    quotes.push(quote);

    if (db) {
      try {
        await db.insert(commodityPrices).values({
          symbol: commodity.symbol,
          name: commodity.name,
          price: String(data.price),
          prevClose: String(data.prevClose),
          change: String(data.change),
          changePct: String(data.changePct),
          currency: data.currency,
          exchange: data.exchange,
          fetchedAt: new Date(),
        });
      } catch (err) {
        console.error(`[Commodities] DB insert error for ${commodity.symbol}:`, err);
      }
    }
  }

  // Also persist USD/BRL rate to commodity_prices for use as fallback
  if (db && usdBrl > 1) {
    try {
      await db.insert(commodityPrices).values({
        symbol: "USDBRL=X",
        name: "Dólar / Real",
        price: String(usdBrl),
        prevClose: String(usdBrl), // live rate used as prevClose too
        change: "0",
        changePct: "0",
        currency: "BRL",
        exchange: "FX",
        fetchedAt: new Date(),
      });
    } catch (err) {
      console.error("[Commodities] DB insert error for USDBRL=X:", err);
    }
  }

  console.log(`[Commodities] Fetched ${quotes.length} quotes`);
  return quotes;
}

/**
 * Get the latest stored quote for each commodity.
 */
export async function getLatestQuotes(): Promise<CommodityQuote[]> {
  const db = await getDb();
  if (!db) return [];

  const results: CommodityQuote[] = [];

  for (const commodity of COMMODITIES) {
    const rows = await db
      .select()
      .from(commodityPrices)
      .where(eq(commodityPrices.symbol, commodity.symbol))
      .orderBy(desc(commodityPrices.fetchedAt))
      .limit(1);

    if (rows.length > 0) {
      const r = rows[0];
      const price = Number(r.price);
      // Recalculate BRL price using cached rate (or fallback)
      const usdBrl = _cachedUsdBrl?.rate ?? 5.80;
      const brlPrice = Math.round(price * commodity.brlFactor * usdBrl * 100) / 100;
      // Recompute all BRL conversions from stored price
      const conv2 = CONVERSION[commodity.convKey];
      let brlPriceSaca2: number | undefined;
      let brlPriceTon2: number | undefined;
      let brlPriceArroba2: number | undefined;
      let brlPriceKg2: number | undefined;
      let brlPriceBushel2: number | undefined;

      if (commodity.convKey === "soja" || commodity.convKey === "milho" || commodity.convKey === "trigo") {
        const c = conv2 as typeof CONVERSION.soja;
        brlPriceSaca2   = Math.round(price * c.brlSacaFactor * usdBrl * 100) / 100;
        brlPriceTon2    = Math.round(price * c.brlTonFactor  * usdBrl * 100) / 100;
        brlPriceBushel2 = Math.round((price / 100) * usdBrl * 100) / 100;
        brlPriceKg2     = Math.round(brlPriceTon2 / 1000 * 100) / 100;
      } else if (commodity.convKey === "algodao") {
        const c = conv2 as typeof CONVERSION.algodao;
        brlPriceArroba2 = Math.round(price * c.brlArrobaFactor * usdBrl * 100) / 100;
        brlPriceTon2    = Math.round(price * c.brlTonFactor    * usdBrl * 100) / 100;
        brlPriceKg2     = Math.round(brlPriceTon2 / 1000 * 100) / 100;
      } else if (commodity.convKey === "boi") {
        const c = conv2 as typeof CONVERSION.boi;
        brlPriceArroba2 = Math.round(price * c.brlArrobaFactor * usdBrl * 100) / 100;
        brlPriceTon2    = Math.round(price * c.brlTonFactor    * usdBrl * 100) / 100;
        brlPriceKg2     = Math.round(brlPriceTon2 / 1000 * 100) / 100;
      } else if (commodity.convKey === "cafe" || commodity.convKey === "acucar") {
        const c = conv2 as typeof CONVERSION.cafe;
        brlPriceSaca2   = Math.round(price * c.brlSacaFactor * usdBrl * 100) / 100;
        brlPriceTon2    = Math.round(price * c.brlTonFactor  * usdBrl * 100) / 100;
        brlPriceKg2     = Math.round(brlPriceTon2 / 1000 * 100) / 100;
      }

      results.push({
        symbol: r.symbol,
        name: commodity.name,
        nameEn: commodity.nameEn,
        unit: commodity.unit,
        flag: commodity.flag,
        brlUnit: commodity.brlUnit,
        category: commodity.category,
        convKey: commodity.convKey,
        price,
        prevClose: Number(r.prevClose ?? 0),
        change: Number(r.change ?? 0),
        changePct: Number(r.changePct ?? 0),
        currency: r.currency,
        exchange: r.exchange ?? "CBT",
        fetchedAt: r.fetchedAt,
        usdBrl,
        brlPrice,
        brlPriceSaca: brlPriceSaca2,
        brlPriceTon: brlPriceTon2,
        brlPriceArroba: brlPriceArroba2,
        brlPriceKg: brlPriceKg2,
        brlPriceBushel: brlPriceBushel2,
      });
    }
  }

  return results;
}

/**
 * Get stored price history for a symbol from the DB (last N days).
 */
export async function getStoredHistory(
  symbol: string,
  days = 30
): Promise<Array<{ fetchedAt: Date; price: number }>> {
  const db = await getDb();
  if (!db) return [];

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({ fetchedAt: commodityPrices.fetchedAt, price: commodityPrices.price })
    .from(commodityPrices)
    .where(
      and(
        eq(commodityPrices.symbol, symbol),
        gte(commodityPrices.fetchedAt, since)
      )
    )
    .orderBy(commodityPrices.fetchedAt);

  return rows.map((r) => ({ fetchedAt: r.fetchedAt, price: Number(r.price) }));
}
