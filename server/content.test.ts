/**
 * content.test.ts
 * Testes para o módulo de geração de conteúdo (Fase 1 — Esteira de Conteúdo)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateLinkedInPost, generateContentImage } from "./contentGenerator";

// Mock do invokeLLM
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content:
            "📈 O mercado de soja enfrenta pressão de baixa.\n\nInsight de valor: A safra brasileira...\n\n• Risco fiscal elevado\n• Custo de oportunidade\n• Estrutura de capital\n\nVisão do consultor: A gestão profissional...\n\nQual é sua estratégia de hedge para 2025?\n\n#AgronegócioBrasil #CréditoRural",
        },
      },
    ],
  }),
}));

// Mock do generateImage
vi.mock("./_core/imageGeneration", () => ({
  generateImage: vi.fn().mockResolvedValue({
    url: "https://cdn.example.com/generated/test-image.png",
  }),
}));

const mockHighlights = [
  {
    title: "Soja em queda no CBOT",
    description: "Contratos futuros recuam 1,5% com safra recorde no Brasil",
    category: "commodities",
  },
  {
    title: "USDA mantém projeção de exportações",
    description: "Relatório mensal confirma demanda chinesa estável",
    category: "internacional",
  },
  {
    title: "Crédito rural cresce 12% no 1T25",
    description: "Banco Central registra expansão do crédito agro",
    category: "mercado",
  },
];

describe("generateLinkedInPost", () => {
  it("deve retornar uma string não vazia com o post", async () => {
    const post = await generateLinkedInPost(
      "Resumo executivo do dia: mercado de soja em queda...",
      mockHighlights,
      "31/03/2025"
    );
    expect(typeof post).toBe("string");
    expect(post.length).toBeGreaterThan(50);
  });

  it("deve incluir hashtags no post gerado", async () => {
    const post = await generateLinkedInPost(
      "Briefing de teste",
      mockHighlights,
      "31/03/2025"
    );
    expect(post).toContain("#");
  });

  it("deve lidar com highlights vazios sem lançar erro", async () => {
    const post = await generateLinkedInPost("Briefing de teste", [], "31/03/2025");
    expect(typeof post).toBe("string");
  });
});

describe("generateContentImage", () => {
  it("deve retornar url e prompt não vazios", async () => {
    const result = await generateContentImage(mockHighlights, "31/03/2025");
    expect(result.url).toBeTruthy();
    expect(result.prompt).toBeTruthy();
  });

  it("deve incluir 'Thiago Lucena' no prompt da imagem", async () => {
    const result = await generateContentImage(mockHighlights, "31/03/2025");
    expect(result.prompt).toContain("Thiago Lucena");
  });

  it("deve incluir 'AGRO GLOBAL INSIGHTS' no prompt da imagem", async () => {
    const result = await generateContentImage(mockHighlights, "31/03/2025");
    expect(result.prompt).toContain("AGRO GLOBAL INSIGHTS");
  });

  it("deve incluir os títulos dos highlights no prompt", async () => {
    const result = await generateContentImage(mockHighlights, "31/03/2025");
    expect(result.prompt).toContain("Soja em queda no CBOT");
  });

  it('deve lidar com highlights vazios sem lançar erro', async () => {
    const result = await generateContentImage([], "31/03/2025");
    expect(result.url).toBeTruthy();
  });

  it('deve incluir assinatura completa no prompt', async () => {
    const result = await generateContentImage(mockHighlights, "31/03/2025");
    expect(result.prompt).toContain("Thiago Lucena");
    expect(result.prompt).toContain("An\u00e1lise Estrat\u00e9gica Agroneg\u00f3cio");
  });

  it('deve incluir paleta de cores institucional no prompt', async () => {
    const result = await generateContentImage(mockHighlights, "31/03/2025");
    expect(result.prompt).toContain("#c9a84c"); // dourado
    expect(result.prompt).toContain("#c0392b"); // vermelho
  });

  it('deve incluir sufixo cinematográfico na variação autoridade', async () => {
    const result = await generateContentImage(mockHighlights, "31/03/2025", "autoridade");
    expect(result.prompt.toLowerCase()).toContain("cinematic");
  });

  it('deve incluir referência a candles na variação financeiro', async () => {
    const result = await generateContentImage(mockHighlights, "31/03/2025", "financeiro");
    expect(result.prompt.toLowerCase()).toContain("candlestick");
  });

  it('deve incluir referência a lavouras na variação agro', async () => {
    const result = await generateContentImage(mockHighlights, "31/03/2025", "agro");
    expect(result.prompt.toLowerCase()).toContain("soybean");
  });

  it('variação padrão não deve ter sufixo extra', async () => {
    const result = await generateContentImage(mockHighlights, "31/03/2025", "padrao");
    expect(result.prompt.toLowerCase()).not.toContain("cinematic");
    expect(result.prompt.toLowerCase()).not.toContain("candlestick");
  });
});
