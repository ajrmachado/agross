import { invokeLLM } from "./_core/llm";
import { getDb } from "./db";
import { articles, dailySummaries, periodicSummaries } from "../drizzle/schema";
import { and, gte, lt, eq, desc, lte } from "drizzle-orm";
import { generateLinkedInPost, generateContentImage, type HighlightItem } from "./contentGenerator";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format a Date as YYYY-MM-DD (UTC) */
function toDateKey(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

/** Get Monday of the ISO week containing `d` */
function getWeekStart(d: Date): Date {
  const day = d.getUTCDay(); // 0=Sun, 1=Mon...
  const diff = (day === 0 ? -6 : 1 - day); // shift to Monday
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diff);
  return toDateKey(monday);
}

/** Get Saturday of the ISO week containing `d` */
function getWeekEnd(d: Date): Date {
  const start = getWeekStart(d);
  const saturday = new Date(start);
  saturday.setUTCDate(start.getUTCDate() + 5); // Mon + 5 = Sat
  return toDateKey(saturday);
}

/** ISO week label: "2026-W12" */
function weekLabel(d: Date): string {
  const start = getWeekStart(d);
  const jan4 = new Date(Date.UTC(start.getUTCFullYear(), 0, 4));
  const week = Math.ceil(
    ((start.getTime() - jan4.getTime()) / 86400000 + jan4.getUTCDay() + 1) / 7
  );
  return `${start.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Month label: "2026-03" */
function monthLabel(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// ─── Shared LLM call ─────────────────────────────────────────────────────────

async function buildPeriodicSummary(
  periodArticles: Array<{ title: string; description: string | null; source: string; category: string; publishedAt: Date | null }>,
  periodType: "weekly" | "monthly",
  periodLabel: string,
  periodStart: Date,
  periodEnd: Date
): Promise<{ content: string; highlights: string }> {
  const periodName = periodType === "weekly" ? "semanal" : "mensal";
  const startStr = periodStart.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });
  const endStr = periodEnd.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });

  const articleList = periodArticles
    .map(
      (a, i) =>
        `[${i + 1}] Fonte: ${a.source} | Categoria: ${a.category}\nTítulo: ${a.title}\n${a.description ? `Resumo: ${a.description.slice(0, 250)}` : ""}`
    )
    .join("\n\n");

  const systemPrompt = `Você é um analista sênior de agronegócio brasileiro com profundo conhecimento em mercados de commodities, política agrícola, crédito rural, clima e logística.
Sua tarefa é criar um briefing executivo ${periodName} consolidado, analítico e estratégico para gestores, traders, consultores e tomadores de decisão do setor agrícola e financeiro.
Escreva em português brasileiro, com linguagem técnica, objetiva e profissional.
DIRETRIZES DE FORMATAÇÃO:
- Use emojis nos títulos das seções (ex: 📊 MERCADO DE COMMODITIES, 🌍 CENÁRIO INTERNACIONAL, 🌦️ CLIMA E SAFRA, 💳 CRÉDITO RURAL, 🎯 INSIGHTS ESTRATÉGICOS, ⚠️ PONTOS DE ATENÇÃO)
- NÃO use linhas separadoras (─────) entre seções
- Escreva parágrafos corridos e justificados, sem usar ** ou __ para negrito
- Para ênfase, use CAIXA ALTA em termos técnicos e números relevantes
- Use hífen simples (-) para listas quando necessário
- Seja analítico: explique causas, impactos e implicações estratégicas, não apenas relate fatos
- Cite dados numéricos, percentuais e variações de preço sempre que disponíveis
- Identifique padrões e tendências ao longo do período completo
- Conecte os eventos ao impacto no crédito rural, fluxo de caixa do produtor e estrutura de capital
- Assinatura ao final: Thiago Lucena | Análise Estratégica Agronegócio - Mercado Financeiro - Crédito`;

  const userPrompt = `Com base nos ${periodArticles.length} artigos coletados de fontes do agronegócio no período de ${startStr} a ${endStr}, crie um briefing executivo ${periodName} completo e analítico.

ARTIGOS DO PERÍODO:
${articleList}

ESTRUTURA DO BRIEFING ${periodName.toUpperCase()}:

📝 RESUMO EXECUTIVO DO PERÍODO
3 a 5 parágrafos corridos e justificados com os principais acontecimentos e tendências do período, suas causas e implicações estratégicas.

📊 MERCADO DE COMMODITIES
Análise dos movimentos de preços no período: soja, milho, algodão, boi gordo, café arábica, açúcar bruto. Cite variações percentuais acumuladas, valores em USD e BRL, e os fatores que impulsionaram cada movimento. Conecte ao impacto no fluxo de caixa do produtor.

🌍 CENÁRIO INTERNACIONAL E GEOPOLÍTICA
Relatórios USDA, exportações brasileiras, movimentos cambiais, disputas comerciais e fatores geopolíticos que afetaram o agronegócio no período. Análise de impacto na competitividade das exportações brasileiras.

🌦️ CLIMA, SAFRA E LOGÍSTICA
Condições climáticas nas principais regiões produtoras, avanço da safra, gargalos logísticos e impacto no escoamento da produção durante o período.

💳 CRÉDITO RURAL E POLÍTICA AGRÍCOLA
Movimentos de taxa de juros, linhas de financiamento agrícola, Plano Safra, programas do MAPA e BNDES no período. Implicações para a estrutura de capital e acesso a crédito.

🎯 INSIGHTS ESTRATÉGICOS E TENDÊNCIAS DO PERÍODO
6 a 8 insights estratégicos: padrões emergentes, oportunidades de mercado, riscos estruturais e movimentos que merecem atenção no próximo período. Conecte à tomada de decisão financeira e operacional.

⚠️ PONTOS DE ATENÇÃO PARA O PRÓXIMO PERÍODO
Riscos, alertas, eventos calendário e temas a monitorar no próximo período.

Thiago Lucena | Análise Estratégica Agronegócio - Mercado Financeiro - Crédito

Seja específico: cite números, percentuais, fontes e nomes de empresas/instituições quando disponíveis. Priorize profundidade analítica sobre quantidade de informação.`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const rawContent = response.choices?.[0]?.message?.content;
  const content = (typeof rawContent === "string" ? rawContent : null) ?? "Não foi possível gerar o resumo.";

  // Generate structured highlights
  const highlightsResponse = await invokeLLM({
    messages: [
      {
        role: "system",
        content: "Você é um analista de agronegócio. Extraia os 6 principais destaques do briefing fornecido como JSON.",
      },
      {
        role: "user",
        content: `Com base neste briefing ${periodName}:\n\n${content}\n\nRetorne um JSON array com 6 objetos no formato:\n[{"title": "Destaque curto", "description": "Explicação em 1 frase", "category": "mercado|clima|politica_agricola|commodities|internacional"}]`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "highlights",
        strict: true,
        schema: {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  category: { type: "string" },
                },
                required: ["title", "description", "category"],
                additionalProperties: false,
              },
            },
          },
          required: ["items"],
          additionalProperties: false,
        },
      },
    },
  });

  let highlights = "[]";
  try {
    const rawHighlights = highlightsResponse.choices?.[0]?.message?.content;
    const parsed = JSON.parse((typeof rawHighlights === "string" ? rawHighlights : null) ?? "{}");
    highlights = JSON.stringify(parsed.items ?? []);
  } catch {
    highlights = "[]";
  }

  return { content, highlights };
}

// ─── Daily Summary ────────────────────────────────────────────────────────────

export async function generateDailySummary(targetDate?: Date): Promise<{
  content: string;
  highlights: string;
  articleCount: number;
  linkedinPost: string | null;
  imageUrl: string | null;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // ─── Determine the correct "content date" in Brasília timezone ─────────────
  // The job runs at ~03:40 BRT (06:40 UTC). At that point, new Date() is already
  // the NEXT calendar day in UTC (e.g. 2026-04-13T06:40Z), but in BRT it is still
  // the previous day until 03:00 BRT. We want to summarise the articles from the
  // BRT calendar day that just ended, not the UTC day that just started.
  //
  // Strategy: if no targetDate is given, derive the "BRT today" string and parse
  // it back to a UTC midnight anchor so dayStart/dayEnd are BRT-aligned.
  let date: Date;
  if (targetDate) {
    date = targetDate;
  } else {
    // Get current time in BRT (UTC-3)
    const nowBRT = new Date(Date.now() - 3 * 60 * 60 * 1000);
    // If it's before 06:00 BRT, we want yesterday's articles
    const brtHour = nowBRT.getUTCHours();
    if (brtHour < 6) {
      // Use yesterday in BRT
      date = new Date(Date.UTC(nowBRT.getUTCFullYear(), nowBRT.getUTCMonth(), nowBRT.getUTCDate() - 1));
    } else {
      date = new Date(Date.UTC(nowBRT.getUTCFullYear(), nowBRT.getUTCMonth(), nowBRT.getUTCDate()));
    }
  }
  // dayStart and dayEnd are BRT midnight boundaries expressed in UTC
  // BRT = UTC-3, so BRT midnight = UTC+03:00
  const dayStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 3, 0, 0));
  const dayEnd   = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1, 3, 0, 0));

  let dayArticles = await db
    .select({
      title: articles.title,
      description: articles.description,
      source: articles.source,
      category: articles.category,
      publishedAt: articles.publishedAt,
      link: articles.link,
    })
    .from(articles)
    .where(and(gte(articles.publishedAt, dayStart), lt(articles.publishedAt, dayEnd)))
    .orderBy(desc(articles.publishedAt))
    .limit(80);

  if (dayArticles.length === 0) {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentArticles = await db
      .select({
        title: articles.title,
        description: articles.description,
        source: articles.source,
        category: articles.category,
        publishedAt: articles.publishedAt,
        link: articles.link,
      })
      .from(articles)
      .where(gte(articles.createdAt, last24h))
      .orderBy(desc(articles.publishedAt))
      .limit(80);

    if (recentArticles.length === 0) {
      return { content: "Nenhum artigo disponível para gerar o resumo do dia.", highlights: "[]", articleCount: 0, linkedinPost: null, imageUrl: null };
    }
    dayArticles.push(...recentArticles);
  }

  const articleList = dayArticles
    .map(
      (a, i) =>
        `[${i + 1}] Fonte: ${a.source} | Categoria: ${a.category}\nTítulo: ${a.title}\n${a.description ? `Resumo: ${a.description.slice(0, 300)}` : ""}`
    )
    .join("\n\n");

  // dateStr: use the UTC date fields of `date` directly (already BRT-aligned)
  const dateStr = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12, 0, 0))
    .toLocaleDateString("pt-BR", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "America/Sao_Paulo" });

  const systemPrompt = `Você é um analista sênior de agronegócio brasileiro com profundo conhecimento em mercados de commodities, política agrícola, crédito rural, clima e logística.
Sua tarefa é criar um briefing executivo diário completo, analítico e estratégico para gestores, traders, consultores e tomadores de decisão do setor agrícola e financeiro.
Escreva em português brasileiro, com linguagem técnica, objetiva e profissional.
DIRETRIZES DE FORMATAÇÃO:
- Use emojis nos títulos das seções (ex: 📊 MERCADO DE COMMODITIES, 🌍 CENÁRIO INTERNACIONAL, 🌦️ CLIMA E SAFRA, 💳 CRÉDITO RURAL, 🎯 INSIGHTS ESTRATÉGICOS, ⚠️ PONTOS DE ATENÇÃO)
- NÃO use linhas separadoras (─────) entre seções
- Escreva parágrafos corridos e justificados, sem usar ** ou __ para negrito
- Para ênfase, use CAIXA ALTA em termos técnicos e números relevantes
- Use hífen simples (-) para listas quando necessário
- Seja analítico: explique causas, impactos e implicações estratégicas, não apenas relate fatos
- Cite dados numéricos, percentuais e variações de preço sempre que disponíveis
- Conecte os eventos ao impacto no crédito rural, fluxo de caixa do produtor e estrutura de capital
- Assinatura ao final: Thiago Lucena | Análise Estratégica Agronegócio - Mercado Financeiro - Crédito`;

  const userPrompt = `Com base nos ${dayArticles.length} artigos coletados de fontes do agronegócio em ${dateStr}, crie um briefing executivo diário completo e analítico.

ARTIGOS DO DIA:
${articleList}

ESTRUTURA DO BRIEFING DIÁRIO:

📝 RESUMO EXECUTIVO DO DIA

3 a 4 parágrafos corridos e justificados com os principais acontecimentos do dia, suas causas e implicações estratégicas para o setor.

📊 MERCADO DE COMMODITIES

Análise dos movimentos de preços: soja, milho, algodão, boi gordo, café arábica, açúcar bruto. Cite variações percentuais, valores em USD e BRL, e o que está impulsionando cada movimento. Conecte ao impacto no fluxo de caixa do produtor e no custo de financiamento.

🌍 CENÁRIO INTERNACIONAL E GEOPOLÍTICA

Relatórios USDA, exportações brasileiras, movimentos cambiais, disputas comerciais e fatores geopolíticos que afetam o agronegócio. Análise de impacto na competitividade das exportações brasileiras.

🌦️ CLIMA, SAFRA E LOGÍSTICA

Condições climáticas nas principais regiões produtoras, avanço da safra, gargalos logísticos e impacto no escoamento da produção. Avalie riscos de perda de qualidade ou volume.

💳 CRÉDITO RURAL E POLÍTICA AGRÍCOLA

Movimentos de taxa de juros, linhas de financiamento agrícola, Plano Safra, programas do MAPA e BNDES. Implicações para a estrutura de capital e acesso a crédito dos produtores e agroindustriais.

🎯 INSIGHTS ESTRATÉGICOS E TENDÊNCIAS

5 a 7 insights estratégicos do dia: padrões emergentes, oportunidades de mercado, riscos estruturais e movimentos que merecem atenção nos próximos dias. Conecte à tomada de decisão financeira e operacional.

⚠️ PONTOS DE ATENÇÃO PARA AS PRÓXIMAS 48H

Riscos imediatos, eventos calendário (relatórios USDA, dados de exportação, decisões de política) e alertas operacionais para produtores e gestores.

Thiago Lucena | Análise Estratégica Agronegócio - Mercado Financeiro - Crédito

Seja específico: cite números, percentuais, fontes e nomes de empresas/instituições quando disponíveis nos artigos. Priorize profundidade analítica sobre quantidade de informação.`;
  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const rawContent = response.choices?.[0]?.message?.content;
  const content = (typeof rawContent === "string" ? rawContent : null) ?? "Não foi possível gerar o resumo.";

  const highlightsResponse = await invokeLLM({
    messages: [
      { role: "system", content: "Você é um analista de agronegócio. Extraia os 5 principais destaques do briefing fornecido como JSON." },
      {
        role: "user",
        content: `Com base neste briefing:\n\n${content}\n\nRetorne um JSON array com 5 objetos no formato:\n[{"title": "Destaque curto", "description": "Explicação em 1 frase", "category": "mercado|clima|politica_agricola|commodities|internacional"}]`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "highlights",
        strict: true,
        schema: {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  category: { type: "string" },
                },
                required: ["title", "description", "category"],
                additionalProperties: false,
              },
            },
          },
          required: ["items"],
          additionalProperties: false,
        },
      },
    },
  });

  let highlights = "[]";
  let highlightItems: HighlightItem[] = [];
  try {
    const rawHighlights = highlightsResponse.choices?.[0]?.message?.content;
    const parsed = JSON.parse((typeof rawHighlights === "string" ? rawHighlights : null) ?? "{}");
    highlightItems = parsed.items ?? [];
    highlights = JSON.stringify(highlightItems);
  } catch {
    highlights = "[]";
  }

  // ─── Gerar post LinkedIn com tom de autoridade ────────────────────────────
  let linkedinPost: string | null = null;
  try {
    linkedinPost = await generateLinkedInPost(content, highlightItems, dateStr);
    console.log("[Summarizer] LinkedIn post generated successfully");
  } catch (err) {
    console.error("[Summarizer] Failed to generate LinkedIn post:", err);
  }

  // ─── Gerar imagem institucional ───────────────────────────────────────────
  let imageUrl: string | null = null;
  let imagePrompt: string | null = null;
  try {
    const imgResult = await generateContentImage(highlightItems, dateStr);
    imageUrl = imgResult.url;
    imagePrompt = imgResult.prompt;
    console.log("[Summarizer] Content image generated:", imageUrl);
  } catch (err) {
    console.error("[Summarizer] Failed to generate content image:", err);
  }

  // summaryDate: UTC midnight of the BRT content date
  const dateKey = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  await db
    .insert(dailySummaries)
    .values({
      summaryDate: dateKey,
      content,
      highlights,
      articleCount: dayArticles.length,
      linkedinPost,
      imageUrl,
      imagePrompt,
      approvalStatus: "pending_approval",
    })
    .onDuplicateKeyUpdate({
      set: {
        content,
        highlights,
        articleCount: dayArticles.length,
        linkedinPost,
        imageUrl,
        imagePrompt,
        approvalStatus: "pending_approval",
        generatedAt: new Date(),
      },
    });

  return { content, highlights, articleCount: dayArticles.length, linkedinPost, imageUrl };
}

// ─── Weekly Summary (Monday → Saturday) ──────────────────────────────────────

export async function generateWeeklySummary(referenceDate?: Date): Promise<{
  content: string;
  highlights: string;
  articleCount: number;
  periodLabel: string;
  periodStart: Date;
  periodEnd: Date;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const ref = referenceDate ?? new Date();
  const weekStart = getWeekStart(ref);
  const weekEnd = getWeekEnd(ref);
  const label = weekLabel(ref);

  // End of Saturday = start of Sunday
  const rangeEnd = new Date(weekEnd);
  rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 1);

  const weekArticles = await db
    .select({
      title: articles.title,
      description: articles.description,
      source: articles.source,
      category: articles.category,
      publishedAt: articles.publishedAt,
    })
    .from(articles)
    .where(and(gte(articles.publishedAt, weekStart), lt(articles.publishedAt, rangeEnd)))
    .orderBy(desc(articles.publishedAt))
    .limit(200);

  if (weekArticles.length === 0) {
    return {
      content: "Nenhum artigo disponível para o período selecionado.",
      highlights: "[]",
      articleCount: 0,
      periodLabel: label,
      periodStart: weekStart,
      periodEnd: weekEnd,
    };
  }

  const { content, highlights } = await buildPeriodicSummary(
    weekArticles, "weekly", label, weekStart, weekEnd
  );

  // Upsert by periodLabel
  const existing = await db
    .select({ id: periodicSummaries.id })
    .from(periodicSummaries)
    .where(and(eq(periodicSummaries.type, "weekly"), eq(periodicSummaries.periodLabel, label)))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(periodicSummaries)
      .set({ content, highlights, articleCount: weekArticles.length, generatedAt: new Date() })
      .where(eq(periodicSummaries.id, existing[0].id));
  } else {
    await db.insert(periodicSummaries).values({
      type: "weekly",
      periodLabel: label,
      periodStart: weekStart,
      periodEnd: weekEnd,
      content,
      highlights,
      articleCount: weekArticles.length,
    });
  }

  console.log(`[Summarizer] Weekly summary generated: ${label} (${weekArticles.length} articles)`);
  return { content, highlights, articleCount: weekArticles.length, periodLabel: label, periodStart: weekStart, periodEnd: weekEnd };
}

// ─── Monthly Summary ──────────────────────────────────────────────────────────

export async function generateMonthlySummary(referenceDate?: Date): Promise<{
  content: string;
  highlights: string;
  articleCount: number;
  periodLabel: string;
  periodStart: Date;
  periodEnd: Date;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const ref = referenceDate ?? new Date();
  const year = ref.getUTCFullYear();
  const month = ref.getUTCMonth();
  const label = monthLabel(ref);

  const monthStart = new Date(Date.UTC(year, month, 1));
  const monthEnd = new Date(Date.UTC(year, month + 1, 0)); // last day of month
  const rangeEnd = new Date(Date.UTC(year, month + 1, 1)); // exclusive end

  const monthArticles = await db
    .select({
      title: articles.title,
      description: articles.description,
      source: articles.source,
      category: articles.category,
      publishedAt: articles.publishedAt,
    })
    .from(articles)
    .where(and(gte(articles.publishedAt, monthStart), lt(articles.publishedAt, rangeEnd)))
    .orderBy(desc(articles.publishedAt))
    .limit(300);

  if (monthArticles.length === 0) {
    return {
      content: "Nenhum artigo disponível para o período selecionado.",
      highlights: "[]",
      articleCount: 0,
      periodLabel: label,
      periodStart: monthStart,
      periodEnd: monthEnd,
    };
  }

  const { content, highlights } = await buildPeriodicSummary(
    monthArticles, "monthly", label, monthStart, monthEnd
  );

  // Upsert by periodLabel
  const existing = await db
    .select({ id: periodicSummaries.id })
    .from(periodicSummaries)
    .where(and(eq(periodicSummaries.type, "monthly"), eq(periodicSummaries.periodLabel, label)))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(periodicSummaries)
      .set({ content, highlights, articleCount: monthArticles.length, generatedAt: new Date() })
      .where(eq(periodicSummaries.id, existing[0].id));
  } else {
    await db.insert(periodicSummaries).values({
      type: "monthly",
      periodLabel: label,
      periodStart: monthStart,
      periodEnd: monthEnd,
      content,
      highlights,
      articleCount: monthArticles.length,
    });
  }

  console.log(`[Summarizer] Monthly summary generated: ${label} (${monthArticles.length} articles)`);
  return { content, highlights, articleCount: monthArticles.length, periodLabel: label, periodStart: monthStart, periodEnd: monthEnd };
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

export async function getLatestPeriodicSummary(type: "weekly" | "monthly") {
  const db = await getDb();
  if (!db) return null;

  const rows = await db
    .select()
    .from(periodicSummaries)
    .where(eq(periodicSummaries.type, type))
    .orderBy(desc(periodicSummaries.generatedAt))
    .limit(1);

  return rows[0] ?? null;
}

export async function getRecentPeriodicSummaries(type: "weekly" | "monthly", limit = 12) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(periodicSummaries)
    .where(eq(periodicSummaries.type, type))
    .orderBy(desc(periodicSummaries.generatedAt))
    .limit(limit);
}

// ─── Custom Period Summary ────────────────────────────────────────────────────

export async function generateCustomPeriodSummary(dateFrom: Date, dateTo: Date): Promise<{
  content: string;
  highlights: string;
  articleCount: number;
  periodLabel: string;
  periodStart: Date;
  periodEnd: Date;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Normalize dates to UTC midnight
  const start = new Date(Date.UTC(dateFrom.getFullYear(), dateFrom.getMonth(), dateFrom.getDate()));
  const endInclusive = new Date(Date.UTC(dateTo.getFullYear(), dateTo.getMonth(), dateTo.getDate()));
  const rangeEnd = new Date(endInclusive);
  rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 1);

  const days = Math.round((endInclusive.getTime() - start.getTime()) / 86400000) + 1;
  const startStr = start.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
  const endStr = endInclusive.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
  const label = `${start.toISOString().slice(0, 10)}_${endInclusive.toISOString().slice(0, 10)}`;

  const periodArticles = await db
    .select({
      title: articles.title,
      description: articles.description,
      source: articles.source,
      category: articles.category,
      publishedAt: articles.publishedAt,
    })
    .from(articles)
    .where(and(gte(articles.publishedAt, start), lt(articles.publishedAt, rangeEnd)))
    .orderBy(desc(articles.publishedAt))
    .limit(300);

  if (periodArticles.length === 0) {
    return {
      content: "Nenhum artigo disponível para o período selecionado.",
      highlights: "[]",
      articleCount: 0,
      periodLabel: label,
      periodStart: start,
      periodEnd: endInclusive,
    };
  }

  const articleList = periodArticles
    .map(
      (a, i) =>
        `[${i + 1}] Fonte: ${a.source} | Categoria: ${a.category}\nTítulo: ${a.title}\n${a.description ? `Resumo: ${a.description.slice(0, 250)}` : ""}`
    )
    .join("\n\n");

  const systemPrompt = `Você é um analista sênior de agronegócio brasileiro com profundo conhecimento em mercados de commodities, política agrícola, crédito rural, clima e logística.
Sua tarefa é criar um briefing executivo consolidado, analítico e estratégico para gestores, traders, consultores e tomadores de decisão do setor agrícola e financeiro.
Escreva em português brasileiro, com linguagem técnica, objetiva e profissional.
DIRETRIZES DE FORMATAÇÃO:
- Use emojis nos títulos das seções (ex: 📊 MERCADO DE COMMODITIES, 🌍 CENÁRIO INTERNACIONAL, 🌦️ CLIMA E SAFRA, 💳 CRÉDITO RURAL, 🎯 INSIGHTS ESTRATÉGICOS, ⚠️ PONTOS DE ATENÇÃO)
- NÃO use linhas separadoras (─────) entre seções
- Escreva parágrafos corridos e justificados, sem usar ** ou __ para negrito
- Para ênfase, use CAIXA ALTA em termos técnicos e números relevantes
- Use hífen simples (-) para listas quando necessário
- Seja analítico: explique causas, impactos e implicações estratégicas, não apenas relate fatos
- Cite dados numéricos, percentuais e variações de preço sempre que disponíveis
- Identifique padrões e tendências ao longo do período completo
- Conecte os eventos ao impacto no crédito rural, fluxo de caixa do produtor e estrutura de capital
- Assinatura ao final: Thiago Lucena | Análise Estratégica Agronegócio - Mercado Financeiro - Crédito`;

  const userPrompt = `Com base nos ${periodArticles.length} artigos coletados de fontes do agronegócio no período de ${startStr} a ${endStr} (${days} dias), crie um briefing executivo consolidado e analítico.

ARTIGOS DO PERÍODO:
${articleList}

ESTRUTURA DO BRIEFING (${startStr} A ${endStr}):

📝 RESUMO EXECUTIVO DO PERÍODO
3 a 5 parágrafos corridos e justificados com os principais acontecimentos e tendências do período, suas causas e implicações estratégicas.

📊 MERCADO DE COMMODITIES
Análise dos movimentos de preços no período: soja, milho, algodão, boi gordo, café arábica, açúcar bruto. Cite variações percentuais acumuladas, valores em USD e BRL, e os fatores que impulsionaram cada movimento.

🌍 CENÁRIO INTERNACIONAL E GEOPOLÍTICA
Relatórios USDA, exportações brasileiras, movimentos cambiais, disputas comerciais e fatores geopolíticos que afetaram o agronegócio no período.

🌦️ CLIMA, SAFRA E LOGÍSTICA
Condições climáticas nas principais regiões produtoras, avanço da safra, gargalos logísticos e impacto no escoamento da produção durante o período.

💳 CRÉDITO RURAL E POLÍTICA AGRÍCOLA
Movimentos de taxa de juros, linhas de financiamento agrícola, Plano Safra, programas do MAPA e BNDES no período. Implicações para a estrutura de capital e acesso a crédito.

🎯 INSIGHTS ESTRATÉGICOS E TENDÊNCIAS DO PERÍODO
6 a 8 insights estratégicos: padrões emergentes, oportunidades de mercado, riscos estruturais e movimentos que merecem atenção no próximo período.

⚠️ PONTOS DE ATENÇÃO PARA O PRÓXIMO PERÍODO
Riscos, alertas, eventos calendário e temas a monitorar após este período.

Thiago Lucena | Análise Estratégica Agronegócio - Mercado Financeiro - Crédito

Seja específico: cite números, percentuais, fontes e nomes de empresas/instituições quando disponíveis.`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const rawContent = response.choices?.[0]?.message?.content;
  const content = (typeof rawContent === "string" ? rawContent : null) ?? "Não foi possível gerar o resumo.";

  // Generate structured highlights
  const highlightsResponse = await invokeLLM({
    messages: [
      { role: "system", content: "Você é um analista de agronegócio. Extraia os 6 principais destaques do briefing fornecido como JSON." },
      { role: "user", content: `Com base neste briefing do período ${startStr} a ${endStr}:\n\n${content}\n\nRetorne um JSON array com 6 objetos no formato:\n[{"title": "Destaque curto", "description": "Explicação em 1 frase", "category": "mercado|clima|politica_agricola|commodities|internacional"}]` },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "highlights",
        strict: true,
        schema: {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  category: { type: "string" },
                },
                required: ["title", "description", "category"],
                additionalProperties: false,
              },
            },
          },
          required: ["items"],
          additionalProperties: false,
        },
      },
    },
  });

  let highlights = "[]";
  try {
    const rawHighlights = highlightsResponse.choices?.[0]?.message?.content;
    const parsed = JSON.parse((typeof rawHighlights === "string" ? rawHighlights : null) ?? "{}");
    highlights = JSON.stringify(parsed.items ?? []);
  } catch {
    highlights = "[]";
  }

  // Always INSERT a new record — each generation creates a new historical entry
  await db.insert(periodicSummaries).values({
    type: "custom",
    periodLabel: label,
    periodStart: start,
    periodEnd: endInclusive,
    content,
    highlights,
    articleCount: periodArticles.length,
  });

  console.log(`[Summarizer] Custom period summary generated: ${label} (${periodArticles.length} articles)`);
  return { content, highlights, articleCount: periodArticles.length, periodLabel: label, periodStart: start, periodEnd: endInclusive };
}

export async function getRecentCustomSummaries(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(periodicSummaries)
    .where(eq(periodicSummaries.type, "custom"))
    .orderBy(desc(periodicSummaries.generatedAt))
    .limit(limit);
}
