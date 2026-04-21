/**
 * whatsappAutoGenerator.ts
 *
 * Generates the WhatsApp Morning Call text automatically via AI,
 * completely independent of the Esteira de Conteúdo (ContentPipeline).
 *
 * Flow:
 *   05:45 BRT → generateAutoWhatsAppText()  → saves to whatsapp_auto_sends (status=pending)
 *   06:00 BRT → sendAutoWhatsApp()          → reads pending record, sends, updates status=sent
 */

import { getDb } from "./db";
import { articles, commodityPrices, whatsappAutoSends } from "../drizzle/schema";
import { desc, gte, lte, and, eq, sql } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the BRT date string (YYYY-MM-DD) for a given offset in days */
function brtDateStr(offsetDays = 0): string {
  const now = new Date();
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  brt.setUTCDate(brt.getUTCDate() + offsetDays);
  return brt.toISOString().slice(0, 10);
}

/** Returns the BRT hour (0-23) */
function brtHour(): number {
  return (new Date().getUTCHours() - 3 + 24) % 24;
}

// ─── Main: generate WhatsApp text for today ───────────────────────────────────

export async function generateAutoWhatsAppText(): Promise<{
  success: boolean;
  sendDate: string;
  message: string;
}> {
  const db = await getDb();
  if (!db) return { success: false, sendDate: "", message: "Database not available" };

  // The "send date" is today in BRT (the day the Morning Call will be sent)
  const sendDate = brtDateStr(0);

  // Check if already generated for today
  const existing = await db
    .select()
    .from(whatsappAutoSends)
    .where(sql`${whatsappAutoSends.sendDate} = ${sendDate}`)
    .limit(1);

  if (existing.length > 0 && existing[0].status !== "failed") {
    console.log(`[WhatsApp Auto] Text already generated for ${sendDate}, skipping`);
    return { success: true, sendDate, message: "Already generated" };
  }

  console.log(`[WhatsApp Auto] Generating Morning Call text for ${sendDate}...`);

  try {
    // ── 1. Fetch articles from yesterday + today up to now ──────────────────
    // Yesterday BRT midnight UTC = yesterday BRT date at 03:00 UTC
    const yesterdayDate = brtDateStr(-1);
    const dayStart = new Date(`${yesterdayDate}T03:00:00Z`); // midnight BRT yesterday
    const dayEnd = new Date();                                 // now (up to 05:59 BRT)

    const recentArticles = await db
      .select({
        title: articles.title,
        description: articles.description,
        source: articles.source,
        category: articles.category,
        publishedAt: articles.publishedAt,
      })
      .from(articles)
      .where(
        and(
          gte(articles.publishedAt, dayStart),
          lte(articles.publishedAt, dayEnd)
        )
      )
      .orderBy(desc(articles.publishedAt))
      .limit(60);

    // ── 2. Fetch latest commodity prices ────────────────────────────────────
    const latestPrices = await db
      .select()
      .from(commodityPrices)
      .orderBy(desc(commodityPrices.fetchedAt))
      .limit(20);

    // Deduplicate by symbol (keep most recent)
    const priceMap = new Map<string, typeof latestPrices[0]>();
    for (const p of latestPrices) {
      if (!priceMap.has(p.symbol)) priceMap.set(p.symbol, p);
    }
    const prices = Array.from(priceMap.values());

    // ── 3. Build commodity summary for prompt ───────────────────────────────
    const commodityLines = prices
      .map((p) => {
        const pct = p.changePct ? `${Number(p.changePct) >= 0 ? "+" : ""}${Number(p.changePct).toFixed(2)}%` : "";
        return `${p.name} (${p.symbol}): US$ ${Number(p.price).toFixed(2)} ${pct}`;
      })
      .join("\n");

    // ── 4. Build article summary for prompt ─────────────────────────────────
    const articleLines = recentArticles
      .slice(0, 30)
      .map((a) => `[${a.category}] ${a.source}: ${a.title}`)
      .join("\n");

    // ── 5. Call LLM to generate WhatsApp text ───────────────────────────────
    // Build the date string in BRT for the title
    const brtNow = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const titleDate = brtNow.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

    const systemPrompt = `Você é um analista especializado em agronegócio brasileiro.
Crie um briefing matinal para WhatsApp em português, conciso e direto, com no máximo 900 caracteres.
Use formatação WhatsApp: *negrito* para títulos e destaques, _itálico_ para ênfase.
Use emojis relevantes (🌱🌽🐄📈📉💰🌦️) com moderação.

Estrutura obrigatória (EXATAMENTE nesta ordem):
1. 🌎 *AGRO GLOBAL INSIGHTS | ${titleDate}*
   _Análise Executiva de Mercado_
2. 📌 *PERSPECTIVAS DO DIA* — 4-5 pontos sobre o que se espera para hoje (mercados, clima, safra, insumos, proteína animal)
3. 📊 *ANÁLISE* — 1 parágrafo executivo sobre o cenário que se abre nesta manhã
4. 🎯 *PONTO DE ATENÇÃO* — 1 insight estratégico para o produtor/agente financeiro observar ao longo do dia
5. 💬 Encerramento: "Dúvidas ou quer aprofundar a análise? Responda esta mensagem."

IMPORTANTE:
- Linguagem de INÍCIO DO DIA: use "hoje", "nesta manhã", "ao longo do dia", "espera-se", "os mercados abrem"
- NUNCA use linguagem de fim de dia como "foi marcado por", "encerrou", "registrou alta/queda", "o dia foi"
- NÃO inclua cotações de preços (já são adicionadas automaticamente no início da mensagem)
- O título DEVE conter a data exatamente como: 🌎 *AGRO GLOBAL INSIGHTS | ${titleDate}*
- NÃO inclua saudação (será adicionada automaticamente)
- NÃO inclua link (será adicionado automaticamente)
- Seja objetivo, profissional e focado no produtor rural e agente financeiro do agronegócio`;

    const userPrompt = `COTAÇÕES DISPONÍVEIS (referência para análise — NÃO inclua no texto):
${commodityLines || "Dados não disponíveis no momento"}

NOTÍCIAS RECENTES (${recentArticles.length} artigos coletados — use como base para perspectivas do dia):
${articleLines || "Nenhum artigo disponível no momento"}

Gere o briefing WhatsApp Morning Call do agronegócio para esta manhã. Lembre-se: linguagem de início do dia, sem data, sem cotações de preços no texto.`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const generatedText =
      (response as { choices?: { message?: { content?: string } }[] })
        ?.choices?.[0]?.message?.content?.trim() ?? "";

    if (!generatedText) {
      throw new Error("LLM returned empty response");
    }

    // ── 6. Save to whatsapp_auto_sends ──────────────────────────────────────
    // Upsert: delete existing failed record if any, then insert
    if (existing.length > 0) {
      await db
        .update(whatsappAutoSends)
        .set({ generatedText, status: "pending", errorMessage: null })
        .where(sql`${whatsappAutoSends.sendDate} = ${sendDate}`);
    } else {
      await db.insert(whatsappAutoSends).values({
        sendDate: new Date(`${sendDate}T12:00:00Z`),
        generatedText,
        status: "pending",
      });
    }

    console.log(`[WhatsApp Auto] Text generated for ${sendDate} (${generatedText.length} chars, ${recentArticles.length} articles)`);
    return { success: true, sendDate, message: `Generated (${recentArticles.length} articles)` };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[WhatsApp Auto] Generation failed for ${sendDate}:`, errorMsg);

    // Save failed record
    if (existing.length > 0) {
      await db
        .update(whatsappAutoSends)
        .set({ status: "failed", errorMessage: errorMsg })
        .where(sql`${whatsappAutoSends.sendDate} = ${sendDate}`);
    } else {
      await db.insert(whatsappAutoSends).values({
        sendDate: new Date(`${sendDate}T12:00:00Z`),
        generatedText: "",
        status: "failed",
        errorMessage: errorMsg,
      });
    }

    return { success: false, sendDate, message: errorMsg };
  }
}

// ─── Get today's pending auto-send record ─────────────────────────────────────

export async function getTodayAutoSend(): Promise<typeof whatsappAutoSends.$inferSelect | null> {
  const db = await getDb();
  if (!db) return null;

  const sendDate = brtDateStr(0);
  const records = await db
    .select()
    .from(whatsappAutoSends)
    .where(sql`${whatsappAutoSends.sendDate} = ${sendDate}`)
    .limit(1);

  return records[0] ?? null;
}

// ─── Mark auto-send as sent with stats ────────────────────────────────────────

export async function markAutoSendComplete(
  sendDate: string,
  stats: { sent: number; failed: number; skipped: number },
  sentText?: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db
    .update(whatsappAutoSends)
    .set({
      status: "sent",
      sentAt: new Date(),
      totalSent: stats.sent,
      totalFailed: stats.failed,
      totalSkipped: stats.skipped,
      ...(sentText ? { sentText } : {}),
    })
    .where(sql`${whatsappAutoSends.sendDate} = ${sendDate}`);

  console.log(`[WhatsApp Auto] Marked ${sendDate} as sent: ${JSON.stringify(stats)}`);
}

// ─── Get history ──────────────────────────────────────────────────────────────

export async function getAutoSendHistory(limit = 30): Promise<typeof whatsappAutoSends.$inferSelect[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(whatsappAutoSends)
    .orderBy(desc(whatsappAutoSends.sendDate))
    .limit(limit);
}
