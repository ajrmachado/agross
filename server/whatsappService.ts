/**
 * WhatsApp Service — Z-API integration
 * Sends the daily Morning Call to all active subscribers at 06:00 BRT.
 *
 * Changes:
 * - Each subscriber gets a personalized link with a unique token (expires 12h)
 * - Token prevents link sharing: if another person opens the link, they see the pricing page
 * - Commodity quotes use CME/ICE international standard (USD/bu, USX/lb, etc.)
 * - Exchange rate uses previous-day closing (BRL=X prevClose) since market is closed at 06:00 BRT
 */

import { getWhatsAppSubscribers, insertWhatsappLog, getDb } from "./db";
import { dailySummaries, commodityPrices } from "../drizzle/schema";
import { desc, eq } from "drizzle-orm";
import { getLatestQuotes, fetchUsdBrl, COMMODITIES } from "./commodities";
import { generateAccessToken } from "./whatsappTokenService";
import { callDataApi } from "./_core/dataApi";

const ZAPI_INSTANCE_ID = process.env.ZAPI_INSTANCE_ID ?? "";
const ZAPI_TOKEN = process.env.ZAPI_TOKEN ?? "";
const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN ?? "";
const AGRORSS_URL = "https://agrordsdash-dnudfrkh.manus.space";

// ─── Z-API send text message ──────────────────────────────────────────────────

export async function sendWhatsAppText(phone: string, message: string): Promise<{ success: boolean; error?: string }> {
  if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN || !ZAPI_CLIENT_TOKEN) {
    return { success: false, error: "Z-API credentials not configured" };
  }

  // Normalize phone: remove all non-digits, ensure starts with country code
  const normalizedPhone = phone.replace(/\D/g, "");

  try {
    const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": ZAPI_CLIENT_TOKEN,
      },
      body: JSON.stringify({
        phone: normalizedPhone,
        message,
      }),
    });

    const data = (await res.json()) as any;

    if (!res.ok || data.error) {
      return { success: false, error: data.error ?? `HTTP ${res.status}` };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message ?? "Unknown error" };
  }
}

// ─── Fetch USD/BRL previous-day closing rate ──────────────────────────────────

/**
 * Returns the USD/BRL rate for the WhatsApp message.
 * Priority order:
 *   1. Live rate from the Cotações tab (commodity_prices table, USDBRL=X) — most recent
 *   2. Live rate from commodities module cache (fetchUsdBrl)
 *   3. API call as last resort (3 retries with backoff)
 *
 * When usePrevClose=true (automatic 06:00 send), uses prevClose from the same DB row.
 * When usePrevClose=false (manual send), uses the live price from DB.
 */
async function fetchUsdBrlPrevClose(usePrevClose = false): Promise<{ rate: number; isClose: boolean }> {
  // ── Priority 1: Read from commodity_prices table (same source as Cotações tab) ──
  try {
    const db = await getDb();
    if (db) {
      const rows = await db
        .select()
        .from(commodityPrices)
        .where(eq(commodityPrices.symbol, "USDBRL=X"))
        .orderBy(desc(commodityPrices.fetchedAt))
        .limit(1);

      if (rows.length > 0) {
        const row = rows[0];
        const liveRate = Number(row.price);
        const prevCloseRate = Number(row.prevClose);
        // Sanity check: R$/USD should be between 2 and 20
        if (usePrevClose && prevCloseRate > 2 && prevCloseRate < 20) {
          console.log(`[WhatsApp] USD/BRL prevClose from DB: ${prevCloseRate}`);
          return { rate: prevCloseRate, isClose: true };
        }
        if (liveRate > 2 && liveRate < 20) {
          console.log(`[WhatsApp] USD/BRL live rate from DB: ${liveRate}`);
          return { rate: liveRate, isClose: false };
        }
      }
    }
  } catch (err) {
    console.error("[WhatsApp] Failed to read USD/BRL from DB:", err);
  }

  // ── Priority 2: Use cached live rate from commodities module ──
  try {
    const cached = await fetchUsdBrl();
    if (cached > 2 && cached < 20) {
      console.log(`[WhatsApp] USD/BRL from commodities cache: ${cached}`);
      return { rate: cached, isClose: false };
    }
  } catch (err) {
    console.error("[WhatsApp] Failed to get USD/BRL from cache:", err);
  }

  // ── Priority 3: Direct API call with retries ──
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
        console.log(`[WhatsApp] Retrying USD/BRL API fetch (attempt ${attempt + 1}/3)...`);
      }
      const response = (await callDataApi("YahooFinance/get_stock_chart", {
        query: { symbol: "USDBRL=X", region: "US", interval: "1d", range: "5d" },
      })) as Record<string, unknown>;
      const chart = response?.chart as Record<string, unknown> | undefined;
      const results = chart?.result as Record<string, unknown>[] | undefined;
      if (!results || results.length === 0) throw new Error("No data");
      const meta = results[0].meta as Record<string, unknown>;
      if (usePrevClose) {
        const prevClose = Number(meta?.chartPreviousClose ?? meta?.previousClose ?? 0);
        if (prevClose > 2 && prevClose < 20) return { rate: prevClose, isClose: true };
      }
      const live = Number(meta?.regularMarketPrice ?? 0);
      if (live > 2 && live < 20) return { rate: live, isClose: false };
    } catch (err) {
      console.error(`[WhatsApp] Failed to fetch USD/BRL from API (attempt ${attempt + 1}/3):`, err);
    }
  }

  // ── No valid rate found — log error, do NOT use hardcoded value ──
  console.error("[WhatsApp] CRITICAL: Could not fetch USD/BRL rate from any source. Returning 0.");
  return { rate: 0, isClose: false };
}

// ─── Build commodity quotes block (CME/ICE standard) ─────────────────────────

/**
 * Builds the commodity quotes block for the WhatsApp Morning Call.
 *
 * Format (CME/ICE international standard):
 *   📊 *Cotações Internacionais* (Fechamento anterior — USD/BRL: R$ X,XX)
 *   🌱 *Soja* (ZS=F · CME): USD 11,64/bu  |  R$ 135,20/sc  |  +0,12%  📈
 *   🌽 *Milho* (ZC=F · CME): USD 4,45/bu  |  R$ 65,40/sc  |  -0,06%  📉
 *   🐄 *Boi Gordo* (LE=F · CME): USD 2,51/cwt  |  R$ 198,50/@  |  +0,38%  📈
 *   🪡 *Algodão* (CT=F · ICE): USD 0,77/lb  |  R$ 57,30/@  |  +4,86%  📈
 *   ☕ *Café Arábica* (KC=F · ICE): USD 2,97/lb  |  R$ 2.210,00/sc  |  +1,09%  📈
 *   🍬 *Açúcar Bruto* (SB=F · ICE): USD 0,14/lb  |  R$ 104,50/sc  |  +0,36%  📈
 *
 * This function is the single source of truth for the quotes block.
 * It is used by both sendMorningCallWhatsApp() and the admin preview procedure.
 */
/**
 * @param usePrevClose - true = usa fechamento do dia anterior (para envio automático 06:00 BRT);
 *                       false = usa cotação em tempo real (para geração manual a qualquer hora)
 */
export async function buildCommodityBlock(usePrevClose = false): Promise<string> {
  try {
    const quotes = await getLatestQuotes();
    if (!quotes || quotes.length === 0) return "";

    // Fetch USD/BRL rate: prevClose for scheduled 06:00 send, live rate for manual generation
    let usdBrl: number;
    let cambioLabel: string;
    if (usePrevClose) {
      const result = await fetchUsdBrlPrevClose();
      usdBrl = result.rate;
      cambioLabel = result.isClose
        ? `Fechamento anterior — USD/BRL: R$ ${usdBrl.toFixed(4).replace(".", ",")}`
        : `USD/BRL: R$ ${usdBrl.toFixed(4).replace(".", ",")} (intraday)`;
    } else {
      usdBrl = await fetchUsdBrl();
      cambioLabel = `USD/BRL: R$ ${usdBrl.toFixed(4).replace(".", ",")} (tempo real)`;
    }

    // Priority order: Soja, Milho, Trigo, Boi Gordo, Algodão, Café, Açúcar
    // (Boi Alimentado omitted to keep the message concise)
    const prioritySymbols = ["ZS=F", "ZC=F", "ZW=F", "LE=F", "CT=F", "KC=F", "SB=F"];

    const selected = prioritySymbols
      .map((sym) => quotes.find((q) => q.symbol === sym))
      .filter(Boolean) as typeof quotes;

    if (selected.length === 0) return "";

    // Exchange label per symbol
    const exchangeLabel: Record<string, string> = {
      "ZS=F": "CME", "ZC=F": "CME", "ZW=F": "CME",
      "LE=F": "CME", "GF=F": "CME",
      "CT=F": "ICE", "KC=F": "ICE", "SB=F": "ICE",
    };

    const lines = selected.map((q) => {
      const sign = q.changePct >= 0 ? "+" : "";
      const pct = `${sign}${q.changePct.toFixed(2)}%`;
      const trend = q.changePct >= 0 ? "📈" : "📉";
      const exch = exchangeLabel[q.symbol] ?? "CME";

      // International price: price is in USX (cents), convert to USD
      // For grains: USX/bu → USD/bu
      // For cattle: USX/cwt → USD/cwt
      // For soft commodities (cotton, coffee, sugar): USX/lb → USD/lb
      const usdPrice = q.price / 100;
      const unitLabel = q.unit.replace("USX/", "USD/");
      const intlPrice = `USD ${usdPrice.toFixed(2)}/${unitLabel.replace("USD/", "")}`;

      // BRL price using previous-day closing rate
      let brlStr = "";
      if (q.brlPriceSaca != null) {
        // Recalculate with prevClose rate
        const commodity = COMMODITIES.find((c) => c.symbol === q.symbol);
        if (commodity) {
          const brlSaca = Math.round(q.price * commodity.brlFactor * usdBrl * 100) / 100;
          brlStr = `R$ ${brlSaca.toFixed(2).replace(".", ",")}/sc`;
        } else {
          brlStr = `R$ ${q.brlPriceSaca.toFixed(2).replace(".", ",")}/sc`;
        }
      } else if (q.brlPriceArroba != null) {
        const commodity = COMMODITIES.find((c) => c.symbol === q.symbol);
        if (commodity) {
          const brlArroba = Math.round(q.price * commodity.brlFactor * usdBrl * 100) / 100;
          brlStr = `R$ ${brlArroba.toFixed(2).replace(".", ",")}/@`;
        } else {
          brlStr = `R$ ${q.brlPriceArroba.toFixed(2).replace(".", ",")}/@`;
        }
      }

      const brlPart = brlStr ? `  |  ${brlStr}` : "";
      return `${q.flag} *${q.name}* (${q.symbol} · ${exch}): ${intlPrice}${brlPart}  |  ${pct} ${trend}`;
    });

    return (
      `📊 *Cotações Internacionais*\n` +
      `_${cambioLabel}_\n` +
      lines.join("\n") +
      "\n"
    );
  } catch (err) {
    console.error("[WhatsApp] Failed to build commodity block:", err);
    return "";
  }
}

// ─── Build Morning Call message ───────────────────────────────────────────────

export async function buildMorningCallMessage(
  recipientName: string,
  whatsappText: string,
  accessToken?: string | null,
  _summaryDate?: string, // kept for API compatibility
  usePrevClose = false
): Promise<string> {
  const firstName = (recipientName ?? "Assinante").split(" ")[0];

  // Build personalized link with token, or generic link if no token
  const accessLink = accessToken
    ? `${AGRORSS_URL}/acesso?token=${accessToken}`
    : `${AGRORSS_URL}/pricing`;

  // Build commodity block: prevClose for 06:00 scheduled send, live rate for manual
  const commodityBlock = await buildCommodityBlock(usePrevClose);

  return (
    `🌱 *AgroRSS Morning Call*\n\n` +
    `Bom dia, ${firstName}! ☀️\n\n` +
    (commodityBlock ? `${commodityBlock}\n` : "") +
    `${whatsappText}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📊 *Acesse o painel completo:*\n` +
    `${accessLink}\n\n` +
    `_Thiago Lucena | Análise Estratégica Agronegócio_\n` +
    `_Para cancelar o recebimento, acesse Meu Perfil no painel._`
  );
}

// ─── Main: send Morning Call to all active subscribers ────────────────────────

export async function sendMorningCallWhatsApp(targetUserId?: number, overrideText?: string | null, usePrevClose = false): Promise<{
  sent: number;
  failed: number;
  skipped: number;
  details: Array<{ userId: number; phone: string; status: string; error?: string }>;
}> {
  const result = { sent: 0, failed: 0, skipped: 0, details: [] as any[] };

  // Get the latest approved WhatsApp summary
  const db = await getDb();
  if (!db) {
    console.error("[WhatsApp] Database not available");
    return result;
  }

  // Always use the most recent summary regardless of approval status
  const allSummaries = await db
    .select()
    .from(dailySummaries)
    .orderBy(desc(dailySummaries.summaryDate), desc(dailySummaries.generatedAt))
    .limit(5);

  // Prefer the most recent one that has whatsappText; otherwise use the most recent overall
  let summary = allSummaries.find((s) => s.whatsappText) ?? allSummaries[0];

  if (!summary) {
    console.warn("[WhatsApp] No summary found — skipping send");
    return result;
  }

  // Use overrideText (from auto-generator) if provided, otherwise use whatsappText from daily_summaries
  const textToSend = overrideText ||
    summary.whatsappText ||
    (summary.content
      ? summary.content.substring(0, 1500) + (summary.content.length > 1500 ? "\n\n_[continua no painel...]_" : "")
      : null);

  if (!textToSend) {
    console.warn("[WhatsApp] No content available — skipping send");
    return result;
  }

  // Get subscribers
  let subscribers = await getWhatsAppSubscribers();

  // If targeting a specific user, filter
  if (targetUserId !== undefined) {
    subscribers = subscribers.filter((u) => u.id === targetUserId);
  }

  if (subscribers.length === 0) {
    console.log("[WhatsApp] No active subscribers to send to");
    return result;
  }

  // Log which summary is being sent
  const summaryDateStr = summary.summaryDate
    ? (summary.summaryDate instanceof Date
        ? summary.summaryDate.toISOString()
        : new Date(summary.summaryDate as string).toISOString()).split("T")[0]
    : "unknown";
  console.log(`[WhatsApp] Sending Morning Call (summaryDate: ${summaryDateStr}) to ${subscribers.length} subscriber(s)...`);

  for (const user of subscribers) {
    if (!user.phone) {
      result.skipped++;
      result.details.push({ userId: user.id, phone: "", status: "skipped", error: "No phone" });
      continue;
    }

    // Generate a unique access token for this subscriber (expires in 12h)
    const accessToken = await generateAccessToken(user.id);

    const message = await buildMorningCallMessage(
      user.name ?? "Assinante",
      textToSend,
      accessToken,
      undefined,
      usePrevClose
    );

    const sendResult = await sendWhatsAppText(user.phone, message);

    if (sendResult.success) {
      result.sent++;
      result.details.push({ userId: user.id, phone: user.phone, status: "sent" });
      await insertWhatsappLog({
        userId: user.id,
        phone: user.phone,
        messageType: "morning_call",
        status: "sent",
      });
    } else {
      result.failed++;
      result.details.push({ userId: user.id, phone: user.phone, status: "failed", error: sendResult.error });
      await insertWhatsappLog({
        userId: user.id,
        phone: user.phone,
        messageType: "morning_call",
        status: "failed",
        errorMessage: sendResult.error,
      });
      console.error(`[WhatsApp] Failed to send to user ${user.id} (${user.phone}):`, sendResult.error);
    }

    // Small delay between sends to avoid rate limiting
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`[WhatsApp] Done — sent: ${result.sent}, failed: ${result.failed}, skipped: ${result.skipped}`);
  return result;
}
