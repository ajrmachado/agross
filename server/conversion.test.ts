/**
 * conversion.test.ts
 * Testes para o motor de conversão de commodities (conversionEngine.ts)
 * e para a procedure generateWhatsApp.
 */
import { describe, it, expect } from "vitest";

// Importar o motor de conversão diretamente do frontend (puro, sem I/O)
// Como é TypeScript puro sem dependências externas, pode ser testado no servidor
import { convertAll, COMMODITY_CONFIGS, PHYSICAL } from "../client/src/lib/conversionEngine";

const USD_BRL = 5.80;

describe("conversionEngine — Soja", () => {
  it("converte R$/saca para US$/bushel corretamente", () => {
    const result = convertAll({
      commodity: "soja",
      value: 130,
      unit: "saca",
      currency: "BRL",
      usdBrl: USD_BRL,
    });

    // R$ 130 / 60kg = R$ 2,1667/kg
    // R$ 2,1667 * 27,216 = R$ 58,97/bushel
    // R$ 58,97 / 5,80 = US$ 10,17/bushel
    const usdBushel = result.internacional.find((l) => l.unitCode === "bushel");
    expect(usdBushel).toBeDefined();
    expect(usdBushel!.value).toBeCloseTo(10.17, 1);
  });

  it("converte US$/bushel para R$/saca corretamente", () => {
    const result = convertAll({
      commodity: "soja",
      value: 10.17,
      unit: "bushel",
      currency: "USD",
      usdBrl: USD_BRL,
    });

    const brlSaca = result.brasil.find((l) => l.unitCode === "saca");
    expect(brlSaca).toBeDefined();
    expect(brlSaca!.value).toBeCloseTo(130, 0);
  });

  it("retorna R$/tonelada como 1000/60 sacas", () => {
    const result = convertAll({
      commodity: "soja",
      value: 130,
      unit: "saca",
      currency: "BRL",
      usdBrl: USD_BRL,
    });

    const ton = result.brasil.find((l) => l.unitCode === "ton");
    expect(ton).toBeDefined();
    // R$ 130 / 60 * 1000 = R$ 2166.67
    expect(ton!.value).toBeCloseTo(2166.67, 0);
  });
});

describe("conversionEngine — Café Arábica", () => {
  it("converte R$/saca para US$/libra corretamente", () => {
    const result = convertAll({
      commodity: "cafe",
      value: 1800,
      unit: "saca",
      currency: "BRL",
      usdBrl: USD_BRL,
    });

    // R$ 1800 / 60kg = R$ 30/kg
    // R$ 30 * 0.453592 = R$ 13.608/libra
    // R$ 13.608 / 5.80 = US$ 2.346/libra
    const usdLibra = result.internacional.find((l) => l.unitCode === "libra");
    expect(usdLibra).toBeDefined();
    expect(usdLibra!.value).toBeCloseTo(2.346, 1);
  });
});

describe("conversionEngine — Boi Gordo", () => {
  it("calcula R$/contrato B3 como 330 arrobas", () => {
    const result = convertAll({
      commodity: "boi",
      value: 340,
      unit: "arroba",
      currency: "BRL",
      usdBrl: USD_BRL,
    });

    const contrato = result.brasil.find((l) => l.unitCode === "contrato");
    expect(contrato).toBeDefined();
    // R$ 340 * 330 = R$ 112.200
    expect(contrato!.value).toBeCloseTo(112200, 0);
  });

  it("retorna R$/tonelada como 1000/15 arrobas", () => {
    const result = convertAll({
      commodity: "boi",
      value: 340,
      unit: "arroba",
      currency: "BRL",
      usdBrl: USD_BRL,
    });

    const ton = result.brasil.find((l) => l.unitCode === "ton");
    expect(ton).toBeDefined();
    // R$ 340 / 15 * 1000 = R$ 22666.67
    expect(ton!.value).toBeCloseTo(22666.67, 0);
  });
});

describe("conversionEngine — Cana-de-açúcar com ATR", () => {
  it("calcula R$/kg ATR quando ATR é fornecido", () => {
    const result = convertAll({
      commodity: "cana",
      value: 110,
      unit: "ton",
      currency: "BRL",
      usdBrl: USD_BRL,
      atr: 140,
    });

    const kgAtr = result.brasil.find((l) => l.unitCode === "kg_atr");
    expect(kgAtr).toBeDefined();
    // R$ 110 / 140 ATR = R$ 0.7857/kg ATR
    expect(kgAtr!.value).toBeCloseTo(0.7857, 3);
  });

  it("não retorna kg ATR quando ATR não é fornecido", () => {
    const result = convertAll({
      commodity: "cana",
      value: 110,
      unit: "ton",
      currency: "BRL",
      usdBrl: USD_BRL,
    });

    const kgAtr = result.brasil.find((l) => l.unitCode === "kg_atr");
    expect(kgAtr).toBeUndefined();
  });
});

describe("conversionEngine — Fatores físicos", () => {
  it("soja tem 27.216 kg/bushel", () => {
    expect(PHYSICAL.soja.kgPerBushel).toBe(27.216);
  });

  it("milho tem 25.401 kg/bushel", () => {
    expect(PHYSICAL.milho.kgPerBushel).toBe(25.401);
  });

  it("libra tem 0.453592 kg", () => {
    expect(PHYSICAL.cafe.kgPerLibra).toBe(0.453592);
  });

  it("arroba tem 15 kg", () => {
    expect(PHYSICAL.boi.kgPerArroba).toBe(15);
  });

  it("contrato B3 boi tem 330 arrobas", () => {
    expect(PHYSICAL.boi.arrobasPorContrato).toBe(330);
  });
});

describe("COMMODITY_CONFIGS", () => {
  it("tem 8 commodities configuradas", () => {
    expect(COMMODITY_CONFIGS.length).toBe(8);
  });

  it("cada commodity tem unidades disponíveis", () => {
    COMMODITY_CONFIGS.forEach((cfg) => {
      expect(cfg.availableUnits.length).toBeGreaterThan(0);
    });
  });

  it("todas as commodities têm flag emoji", () => {
    COMMODITY_CONFIGS.forEach((cfg) => {
      expect(cfg.flag).toBeTruthy();
    });
  });
});
