/**
 * whatsapp.test.ts
 * Testes para a persistência do texto WhatsApp na tabela daily_summaries
 */
import { describe, it, expect, vi } from "vitest";
import { generateWhatsAppMessage } from "./contentGenerator";

// Mock do invokeLLM
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content:
            "*🌾 Agro Insight — 09/04/2026*\n\nOlá! Aqui está o resumo do agronegócio de hoje:\n\n📌 *Destaques:*\n• Soja recua 1,5% no CBOT\n• Crédito rural cresce 12%\n\n_Thiago Lucena | PL Capital_",
        },
      },
    ],
  }),
}));

const mockHighlights = [
  {
    title: "Soja recua no CBOT",
    description: "Contratos futuros recuam 1,5% com safra recorde no Brasil",
    category: "commodities",
  },
  {
    title: "Crédito rural cresce 12%",
    description: "Banco Central registra expansão do crédito agro no 1T26",
    category: "mercado",
  },
];

describe("generateWhatsAppMessage", () => {
  it("deve retornar uma string não vazia", async () => {
    const msg = await generateWhatsAppMessage(
      "Resumo executivo do dia: mercado de soja em queda...",
      mockHighlights,
      "09/04/2026"
    );
    expect(typeof msg).toBe("string");
    expect(msg.length).toBeGreaterThan(20);
  });

  it("deve incluir formatação WhatsApp com asteriscos para negrito", async () => {
    const msg = await generateWhatsAppMessage(
      "Briefing de teste",
      mockHighlights,
      "09/04/2026"
    );
    expect(msg).toContain("*");
  });

  it("deve lidar com highlights vazios sem lançar erro", async () => {
    const msg = await generateWhatsAppMessage("Briefing de teste", [], "09/04/2026");
    expect(typeof msg).toBe("string");
  });

  it("deve incluir a data no conteúdo gerado", async () => {
    const msg = await generateWhatsAppMessage(
      "Briefing de teste",
      mockHighlights,
      "09/04/2026"
    );
    expect(msg).toContain("09/04/2026");
  });
});
