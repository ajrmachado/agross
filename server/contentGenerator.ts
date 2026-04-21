/**
 * contentGenerator.ts
 * Fase 1 — Esteira de Conteúdo: geração de post LinkedIn, imagem institucional e mensagem WhatsApp
 */
import { invokeLLM } from "./_core/llm";
import { generateImage } from "./_core/imageGeneration";

export interface HighlightItem {
  title: string;
  description: string;
  category: string;
}

/**
 * Variações de estilo para geração de imagem.
 * - "padrao"      → layout padrão Agro Insight (Bloomberg/FT)
 * - "autoridade"  → iluminação cinematográfica, contraste alto, sofisticação máxima
 * - "financeiro"  → ênfase em gráficos de linha, candles, indicadores econômicos
 * - "agro"        → destaque visual para lavouras, pecuária e insumos agrícolas
 */
export type ImageVariant = "padrao" | "autoridade" | "financeiro" | "agro";

// ─── Post LinkedIn ────────────────────────────────────────────────────────────

export async function generateLinkedInPost(
  briefingContent: string,
  highlights: HighlightItem[],
  dateStr: string
): Promise<string> {
  const highlightsSummary = highlights
    .slice(0, 5)
    .map((h, i) => `${i + 1}. [${h.category.toUpperCase()}] ${h.title}: ${h.description}`)
    .join("\n");

  const systemPrompt = `Atue como um Especialista em Branding Executivo e Estrategista de Conteúdo para o LinkedIn.

Objetivo: Transformar dados brutos, notícias ou insights de mercado em posts de alta autoridade para o perfil de um Consultor Estratégico com 20 anos de mercado financeiro e foco em Agronegócio/Crédito Estruturado.

Persona do Autor: Thiago Lucena — Um advisor sênior que conecta produtores e empresas a bancos e fundos. O tom deve ser sóbrio, analítico, direto e provocativo (sem ser agressivo).

Diretrizes de Estilo:
- Evite clichês de "coach" ou entusiasmo excessivo. Proibido usar "Estou muito feliz em compartilhar".
- Use emojis de forma minimalista e corporativa (ex: 🏛️, 📈, ⚖️, 🎯).
- Foco total em atrair tomadores de decisão (CEOs, Diretores, Grandes Produtores).`;

  const userPrompt = `Com base no briefing executivo do agronegócio de ${dateStr} e nos destaques abaixo, crie um post de alta autoridade para o LinkedIn.

DESTAQUES DO DIA:
${highlightsSummary}

BRIEFING (use como base analítica):
${briefingContent.slice(0, 3000)}

ESTRUTURA OBRIGATÓRIA DO POST:

1. GANCHO (Headline): Uma frase de impacto que conecte o fato ao bolso, ao risco ou à oportunidade de mercado.

2. O INSIGHT DE VALOR: Traduzir o dado bruto em "linguagem de decisão". Não apenas dizer o que aconteceu, mas o que isso significa para o fluxo de capital e governança.

3. PONTOS DE ANÁLISE (Bullet points): 3 pontos curtos e escaneáveis usando termos técnicos adequados (ex: risco fiscal, custo de oportunidade, estrutura de capital, liquidez).

4. A VISÃO DO CONSULTOR: Um parágrafo conectando o tema à necessidade de uma consultoria estratégica. Por que a gestão profissional faz diferença nesse cenário?

5. CTA (Call to Action) Variável: Uma pergunta técnica que gere debate OU um convite para troca de percepções via Direct.

6. HASHTAGS: 5 a 6 hashtags estratégicas de mercado.

REGRAS:
- Máximo 3.000 caracteres no total
- Não mencione "Thiago Lucena" no corpo do post (ele é o autor)
- Não use markdown com ** para formatar — use letras maiúsculas para títulos de seção se necessário
- Seja específico: cite números, percentuais e tendências do briefing
- Escreva em português brasileiro
- Emojis minimalistas e corporativos apenas: 🏛️ 📈 ⚖️ 🎯 🌾 📊 ⚠️ 🏦`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const rawContent = response.choices?.[0]?.message?.content;
  return (typeof rawContent === "string" ? rawContent : null) ?? "Não foi possível gerar o post.";
}

// ─── Mensagem WhatsApp ────────────────────────────────────────────────────────

export async function generateWhatsAppMessage(
  briefingContent: string,
  highlights: HighlightItem[],
  dateStr: string
): Promise<string> {
  const highlightsSummary = highlights
    .slice(0, 5)
    .map((h, i) => `${i + 1}. [${h.category.toUpperCase()}] ${h.title}: ${h.description}`)
    .join("\n");

  const systemPrompt = `Você é um especialista em comunicação executiva para WhatsApp.
Crie mensagens de MORNING CALL que sejam lidas rapidamente no celular, com hierarquia visual clara usando emojis e formatação WhatsApp (*negrito*, _itálico_).
Tom: profissional, direto, informativo. Autor: Thiago Lucena — Consultor Estratégico em Agronegócio e Crédito Estruturado.
IMPORTANTE: Use SEMPRE linguagem de início do dia. Use "hoje", "nesta manhã", "espera-se", "os mercados abrem", "ao longo do dia". NUNCA use linguagem de fim de dia como "foi marcado por", "encerrou", "registrou alta/queda", "o dia foi", "ontem".`;

  const userPrompt = `Com base no briefing executivo do agronegócio e nos destaques abaixo, crie uma mensagem formatada para WhatsApp.

DESTAQUES DO DIA:
${highlightsSummary}

BRIEFING (use como base analítica):
${briefingContent.slice(0, 2500)}

ESTRUTURA OBRIGATÓRIA:

🌾 *AGRO GLOBAL INSIGHTS*
_Análise Executiva de Mercado_

📌 *DESTAQUES DO DIA*
[3 a 5 bullets curtos com emoji temático no início de cada linha]

📊 *ANÁLISE*
[2 parágrafos curtos com o insight mais relevante do dia, linguagem de decisão]

🎯 *PONTO DE ATENÇÃO*
[1 parágrafo sobre o principal risco ou oportunidade para quem atua com crédito/comercialização]

💬 *Dúvidas ou quer aprofundar a análise? Responda esta mensagem.*

—
_Thiago Lucena_
_Análise Estratégica Agronegócio - Mercado Financeiro - Crédito_

REGRAS:
- Máximo 1.500 caracteres
- NÃO inclua a data no texto (a data será adicionada automaticamente pelo sistema)
- NÃO inclua cotações de preços (soja, milho, dólar, etc.) pois elas serão adicionadas automaticamente
- Use emojis temáticos no início de cada bullet (🌱 soja, 🌽 milho, 🐄 boi, ☕ café, 💵 câmbio, 📉 queda, 📈 alta, ⚠️ risco, 🏦 crédito, 🌍 geopolítica)
- Use *negrito* para termos-chave e títulos de seção
- Use _itálico_ para notas e assinatura
- Escreva em português brasileiro
- Parágrafos curtos, máximo 3 linhas cada
- Não use HTML nem markdown, apenas formatação WhatsApp`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const rawContent = response.choices?.[0]?.message?.content;
  return (typeof rawContent === "string" ? rawContent : null) ?? "Não foi possível gerar a mensagem.";
}

// ─── Imagem Institucional — Agro Insight ─────────────────────────────────────

/**
 * Sufixos de variação adicionados ao prompt base.
 * Cada variação intensifica um aspecto visual específico.
 */
const VARIANT_SUFFIXES: Record<ImageVariant, string> = {
  padrao: "",
  autoridade:
    "Apply cinematic lighting with dramatic shadows, high contrast, and realistic texture to convey maximum sophistication and institutional credibility. Deep field of view, premium print quality.",
  financeiro:
    "Emphasize financial data visualization: include candlestick charts, line graphs with moving averages, economic indicators, and trading terminal aesthetics in the background layers.",
  agro:
    "Give prominent visual space to Brazilian agriculture: photorealistic soybean fields, cattle, coffee plantations, and agro-industrial elements. Blend rural landscape with financial data overlays.",
};

export async function generateContentImage(
  highlights: HighlightItem[],
  dateStr: string,
  variant: ImageVariant = "padrao"
): Promise<{ url: string; prompt: string }> {
  const topHighlights = highlights.slice(0, 5);

  // Extrair o highlight de alerta (risco/queda) para o bloco vermelho, se houver
  const alertHighlight =
    topHighlights.find(
      (h) =>
        h.category === "geopolitica" ||
        h.title.toLowerCase().includes("risco") ||
        h.title.toLowerCase().includes("alerta") ||
        h.title.toLowerCase().includes("queda") ||
        h.title.toLowerCase().includes("déficit")
    ) ?? topHighlights[0];

  const contentHighlights = topHighlights
    .filter((h) => h !== alertHighlight)
    .slice(0, 4)
    .map((h) => `"${h.title}"`)
    .join(", ");

  const variantSuffix = VARIANT_SUFFIXES[variant] ?? "";

  const imagePrompt = `Create a premium editorial infographic image for LinkedIn in portrait format (4:5 ratio), inspired by Bloomberg Terminal, Financial Times, and top investment bank reports.

VISUAL IDENTITY:
- Color palette: deep black/graphite base (#0a0a0a), dark institutional blue (#0d1b2a), strategic gold/yellow highlights (#c9a84c), red for alerts (#c0392b), white for text contrast
- Style: modern, corporate, sophisticated — dense but organized layout
- Mood: strategic intelligence, market urgency, institutional authority — "a report turned into an image"

LAYOUT STRUCTURE (top to bottom):

1. HEADER (top section):
   - Main title in bold uppercase: "AGRO GLOBAL INSIGHTS"
   - Subtitle: "${dateStr}" in gold color
   - Background: subtle digital radar or world map overlay with data grid lines

2. ALERT BLOCK (upper-middle):
   - Red/orange highlighted box with warning icon ⚠️
   - Short bold text: "${alertHighlight?.title ?? "MARKET ALERT"}"
   - High contrast, urgent visual weight

3. CONTENT BLOCKS (middle section — 3 columns or 2+1 grid):
   - 💰 Capital Markets: financial charts, documents, currency symbols
   - 🌾 Commodities: photorealistic soybean, corn, cattle, coffee elements
   - 🌎 Geopolitics/Logistics: world map with trade routes, shipping lanes, dotted arrows
   Key insights as short text overlays: ${contentHighlights}

4. BASE/BACKGROUND:
   - Brazilian agricultural landscape (soybean field horizon, productive farmland)
   - Smooth gradient transition from financial digital to agro-natural

5. SIGNATURE (bottom center):
   - Elegant signature-style typography in white or gold:
     "Thiago Lucena"
     "Análise Estratégica Agronegócio - Mercado Financeiro - Crédito"
   - Centered, refined, understated — two lines stacked

IMPORTANT RULES:
- NO Bloomberg logo or any third-party brand marks
- NO cluttered text — keep it visually clean and scannable
- NO childish or oversaturated colors
- NO generic Instagram post aesthetic
- Photorealistic elements mixed with clean digital design overlays
- High resolution, 4K quality${variantSuffix ? "\n\nADDITIONAL STYLE DIRECTION: " + variantSuffix : ""}`;

  const { url } = await generateImage({ prompt: imagePrompt });

  return {
    url: url ?? "",
    prompt: imagePrompt,
  };
}
