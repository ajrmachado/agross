import { getDb } from "./db";
import { users, dailySummaries, emailDailySends } from "../drizzle/schema";
import { eq, desc, and, gte, lt, sql } from "drizzle-orm";
import { notifyOwner } from "./_core/notification";
import { getLatestQuotes } from "./commodities";

// ─── Types ────────────────────────────────────────────────────────────────────

type ActiveSubscriber = {
  id: number;
  name: string | null;
  email: string | null;
  subscriptionPlan: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getActiveSubscribers(): Promise<ActiveSubscriber[]> {
  const db = await getDb();
  if (!db) return [];

  const result = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      subscriptionPlan: users.subscriptionPlan,
    })
    .from(users)
    .where(eq(users.subscriptionStatus, "active"));

  return result;
}

async function getLatestSummary() {
  const db = await getDb();
  if (!db) return null;

  const today = new Date();
  const dayStart = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const dayEnd = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() + 1));

  const todayRows = await db
    .select()
    .from(dailySummaries)
    .where(and(gte(dailySummaries.summaryDate, dayStart), lt(dailySummaries.summaryDate, dayEnd)))
    .limit(1);

  if (todayRows.length > 0) return todayRows[0];

  const recentRows = await db
    .select()
    .from(dailySummaries)
    .orderBy(desc(dailySummaries.summaryDate))
    .limit(1);

  return recentRows.length > 0 ? recentRows[0] : null;
}

// ─── Guard persistido no banco (substitui variável em memória) ────────────────

/** Returns the BRT date string (YYYY-MM-DD) */
function brtDateStr(): string {
  const now = new Date();
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  return brt.toISOString().slice(0, 10);
}

/**
 * Check if the daily email has already been sent today (BRT).
 * Uses the DATABASE — not an in-memory variable — so it survives server restarts.
 */
export async function hasEmailBeenSentToday(): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const today = brtDateStr();
  const records = await db
    .select()
    .from(emailDailySends)
    .where(sql`${emailDailySends.sendDate} = ${today}`)
    .limit(1);

  return records.length > 0 && records[0].status === "sent";
}

/**
 * Mark the daily email as sent in the database.
 */
async function markEmailSentInDb(subscriberCount: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const today = brtDateStr();
  try {
    await db.insert(emailDailySends).values({
      sendDate: sql`${today}`,
      sentAt: new Date(),
      subscriberCount,
      status: "sent",
    });
  } catch (err) {
    // If unique constraint violation (already exists), update instead
    await db
      .update(emailDailySends)
      .set({ sentAt: new Date(), subscriberCount, status: "sent", errorMessage: null })
      .where(sql`${emailDailySends.sendDate} = ${today}`);
  }
}

// ─── Format helpers ───────────────────────────────────────────────────────────

/**
 * Build an HTML table for commodity quotes.
 * Each culture gets its own row with color-coded variation.
 */
function buildCommodityTable(quotes: Awaited<ReturnType<typeof getLatestQuotes>>): string {
  if (quotes.length === 0) {
    return "<p style='color:#666;font-style:italic;'>Cotações não disponíveis no momento.</p>";
  }

  const rows = quotes
    .map((q) => {
      const unitClean = q.unit.replace("USX/", "");
      const usdStr = `US$ ${(q.price / 100).toFixed(2)}/${unitClean}`;
      const brlStr =
        q.brlPrice != null && q.brlUnit
          ? `R$ ${q.brlPrice.toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })} ${q.brlUnit}`
          : "—";
      const isPositive = q.changePct >= 0;
      const arrow = isPositive ? "▲" : "▼";
      const changeColor = isPositive ? "#16a34a" : "#dc2626";
      const changeStr = isPositive
        ? `+${q.changePct.toFixed(2)}%`
        : `${q.changePct.toFixed(2)}%`;

      return `
        <tr style="border-bottom:1px solid #e5e7eb;">
          <td style="padding:10px 12px;font-weight:600;white-space:nowrap;">${q.flag} ${q.name}</td>
          <td style="padding:10px 12px;color:#374151;font-family:monospace;white-space:nowrap;">${q.symbol}</td>
          <td style="padding:10px 12px;font-family:monospace;white-space:nowrap;">${usdStr}</td>
          <td style="padding:10px 12px;font-family:monospace;white-space:nowrap;">${brlStr}</td>
          <td style="padding:10px 12px;color:${changeColor};font-weight:700;white-space:nowrap;">${arrow} ${changeStr}</td>
        </tr>`;
    })
    .join("");

  return `
<table style="width:100%;border-collapse:collapse;font-size:14px;font-family:Arial,sans-serif;background:#fff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
  <thead>
    <tr style="background:#1a3a2a;color:#fff;">
      <th style="padding:10px 12px;text-align:left;font-weight:700;">Cultura</th>
      <th style="padding:10px 12px;text-align:left;font-weight:700;">Símbolo</th>
      <th style="padding:10px 12px;text-align:left;font-weight:700;">Cotação (USD)</th>
      <th style="padding:10px 12px;text-align:left;font-weight:700;">Equiv. (BRL)</th>
      <th style="padding:10px 12px;text-align:left;font-weight:700;">Variação</th>
    </tr>
  </thead>
  <tbody>${rows}
  </tbody>
</table>`;
}

/**
 * Convert plain-text briefing sections into HTML with bold emoji titles.
 * Detects lines starting with an emoji followed by ALL-CAPS text as section headers.
 */
function formatBriefingAsHtml(text: string): string {
  const lines = text.split("\n");
  const htmlLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip separator lines completely
    if (/^[╋─=\-]{4,}/.test(trimmed)) continue;

    // Detect section headers: lines where first char is an emoji (code point > 0x2500)
    // and the rest is mostly uppercase — used to bold the title in HTML
    const firstCodePoint = trimmed.codePointAt(0) ?? 0;
    const isEmojiStart = firstCodePoint > 0x2500;
    const restAfterEmoji = trimmed.slice(trimmed.indexOf(" ") + 1);
    const isMostlyUppercase = restAfterEmoji.length > 3 && restAfterEmoji === restAfterEmoji.toUpperCase();
    if (isEmojiStart && isMostlyUppercase && trimmed.length < 80) {
      htmlLines.push(`<p style="margin:20px 0 6px 0;"><strong style="font-size:15px;color:#1a3a2a;">${trimmed}</strong></p>`);
      continue;
    }

    // Signature line
    if (trimmed.startsWith("Thiago Lucena")) {
      htmlLines.push(`<p style="margin:24px 0 4px 0;color:#374151;font-weight:600;">${trimmed}</p>`);
      continue;
    }

    // Empty line → paragraph break
    if (trimmed === "") {
      htmlLines.push("");
      continue;
    }

    // Regular paragraph text
    htmlLines.push(`<p style="margin:0 0 10px 0;text-align:justify;line-height:1.7;color:#1f2937;">${trimmed}</p>`);
  }

  return htmlLines.join("\n");
}

/**
 * Build the full HTML email body.
 */
function buildHtmlEmail(
  subscriberName: string | null,
  summaryContent: string,
  articleCount: number,
  commodityTableHtml: string,
  dateStr: string
): string {
  const greeting = subscriberName ? `Olá, ${subscriberName}!` : "Olá!";
  const briefingHtml = formatBriefingAsHtml(summaryContent);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;">
    <tr><td align="center">
      <table width="640" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);max-width:640px;">

        <!-- Header -->
        <tr>
          <td style="background:#1a3a2a;padding:28px 32px;">
            <p style="margin:0;color:#a3c4a0;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Briefing Executivo</p>
            <h1 style="margin:6px 0 0 0;color:#ffffff;font-size:22px;font-weight:700;">📊 Agronegócio &amp; Mercado Financeiro</h1>
            <p style="margin:8px 0 0 0;color:#a3c4a0;font-size:13px;">${dateStr}</p>
          </td>
        </tr>

        <!-- Greeting -->
        <tr>
          <td style="padding:24px 32px 8px 32px;">
            <p style="margin:0;font-size:15px;color:#374151;">${greeting}</p>
            <p style="margin:8px 0 0 0;font-size:14px;color:#6b7280;">Seu briefing diário com <strong>${articleCount} artigos analisados</strong> pelas principais fontes do agronegócio e mercado financeiro.</p>
          </td>
        </tr>

        <!-- Cotações Section -->
        <tr>
          <td style="padding:20px 32px 8px 32px;">
            <p style="margin:0 0 12px 0;font-size:15px;font-weight:700;color:#1a3a2a;">📈 Cotações de Commodities</p>
            ${commodityTableHtml}
            <p style="margin:8px 0 0 0;font-size:11px;color:#9ca3af;">Cotações em tempo real via Yahoo Finance. Valores em USD e equivalente BRL.</p>
          </td>
        </tr>

        <!-- Divider -->
        <tr><td style="padding:16px 32px;"><hr style="border:none;border-top:1px solid #e5e7eb;margin:0;"></td></tr>

        <!-- Briefing Content -->
        <tr>
          <td style="padding:8px 32px 24px 32px;">
            <p style="margin:0 0 16px 0;font-size:15px;font-weight:700;color:#1a3a2a;">📝 Análise do Dia</p>
            <div style="font-size:14px;line-height:1.7;color:#1f2937;">
              ${briefingHtml}
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:13px;font-weight:700;color:#1a3a2a;">Thiago Lucena</p>
            <p style="margin:4px 0 0 0;font-size:12px;color:#6b7280;">Análise Estratégica Agronegócio · Mercado Financeiro · Crédito</p>
            <p style="margin:12px 0 0 0;font-size:11px;color:#9ca3af;">AgroRSS Dashboard — Inteligência para o Agronegócio Brasileiro</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Build plain-text fallback (for clients that don't render HTML).
 */
function buildPlainTextEmail(
  subscriberName: string | null,
  summaryContent: string,
  articleCount: number,
  quotes: Awaited<ReturnType<typeof getLatestQuotes>>,
  dateStr: string
): string {
  const greeting = subscriberName ? `Olá, ${subscriberName}!` : "Olá!";

  const quotesText = quotes.length === 0
    ? "Cotações não disponíveis."
    : quotes.map((q) => {
        const unitClean = q.unit.replace("USX/", "");
        const usdStr = `US$ ${(q.price / 100).toFixed(2)}/${unitClean}`;
        const brlStr = q.brlPrice != null && q.brlUnit
          ? ` | R$ ${q.brlPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${q.brlUnit}`
          : "";
        const arrow = q.changePct >= 0 ? "▲" : "▼";
        const changeStr = q.changePct >= 0 ? `+${q.changePct.toFixed(2)}%` : `${q.changePct.toFixed(2)}%`;
        return `${q.flag} ${q.name} (${q.symbol}): ${usdStr}${brlStr} | ${arrow} ${changeStr}`;
      }).join("\n");

  return `${greeting}

BRIEFING EXECUTIVO DO AGRONEGÓCIO
${dateStr}
${articleCount} artigos analisados

📈 COTAÇÕES DE COMMODITIES

${quotesText}

📝 ANÁLISE DO DIA

${summaryContent}

---
Thiago Lucena
Análise Estratégica Agronegócio - Mercado Financeiro - Crédito
AgroRSS Dashboard | Inteligência para o Agronegócio Brasileiro`;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function sendDailySummaryEmail(force = false): Promise<{
  sent: boolean;
  subscriberCount: number;
  message: string;
}> {
  // GUARD: check DATABASE (not in-memory variable) — survives server restarts
  if (!force) {
    const alreadySent = await hasEmailBeenSentToday();
    if (alreadySent) {
      console.log("[Email] Daily email already sent today (DB guard) — skipping.");
      return { sent: false, subscriberCount: 0, message: "Resumo já enviado hoje." };
    }
  }

  const subscribers = await getActiveSubscribers();
  const subscriberCount = subscribers.length;

  if (subscriberCount === 0) {
    console.log("[Email] No active subscribers. Skipping daily summary email.");
    return { sent: false, subscriberCount: 0, message: "Nenhum assinante ativo." };
  }

  try {
    const summary = await getLatestSummary();
    const quotes = await getLatestQuotes();
    const dateStr = new Date().toLocaleDateString("pt-BR", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
      timeZone: "America/Sao_Paulo",
    });
    const summaryContent = summary
      ? summary.content.slice(0, 8000)
      : "O resumo do dia ainda está sendo gerado. Acesse o painel para conferir em breve.";
    const articleCount = summary?.articleCount ?? 0;
    const commodityTableHtml = buildCommodityTable(quotes);

    const htmlBody = buildHtmlEmail(null, summaryContent, articleCount, commodityTableHtml, dateStr);
    const plainBody = buildPlainTextEmail(null, summaryContent, articleCount, quotes, dateStr);

    const subscriberList = subscribers
      .map((s) => `• ${s.name ?? "Usuário"} (${s.email ?? "sem e-mail"}) — plano ${s.subscriptionPlan ?? "?"}`)
      .join("\n");

    const notificationContent = `Resumo diário enviado para ${subscriberCount} assinante(s):\n\n${subscriberList}\n\n---\n\n${plainBody}`;
    const title = `📊 Briefing Agro — ${new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`;

    await notifyOwner({ title, content: notificationContent });

    // Persist the guard in the database — prevents re-sending on server restart
    await markEmailSentInDb(subscriberCount);
    console.log(`[Email] Daily summary sent to ${subscriberCount} subscriber(s). Guard saved to DB for ${brtDateStr()}`);

    return {
      sent: true,
      subscriberCount,
      message: `Briefing enviado com sucesso para ${subscriberCount} assinante(s).`,
    };
  } catch (err) {
    console.error("[Email] Failed to send daily summary:", err);
    return {
      sent: false,
      subscriberCount: 0,
      message: `Erro ao enviar: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Build and return the email body for a specific summary (used by the content approval panel).
 * Returns both HTML and plain-text versions.
 */
export async function buildBriefingEmailForSummary(
  summaryContent: string,
  articleCount: number
): Promise<string> {
  const quotes = await getLatestQuotes();
  const dateStr = new Date().toLocaleDateString("pt-BR", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    timeZone: "America/Sao_Paulo",
  });

  const commodityTableHtml = buildCommodityTable(quotes);
  return buildHtmlEmail(null, summaryContent, articleCount, commodityTableHtml, dateStr);
}
