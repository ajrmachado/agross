import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock database helpers ────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getAllFeeds: vi.fn().mockResolvedValue([
    {
      id: 1,
      name: "Notícias Agrícolas",
      url: "https://www.noticiasagricolas.com.br/rss",
      category: "mercado",
      active: true,
      lastFetchedAt: null,
      fetchErrorCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 2,
      name: "USDA Blog",
      url: "https://www.usda.gov/media/blog/rss.xml",
      category: "internacional",
      active: false,
      lastFetchedAt: new Date(),
      fetchErrorCount: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]),
  insertFeed: vi.fn().mockResolvedValue(undefined),
  updateFeedActive: vi.fn().mockResolvedValue(undefined),
  deleteFeed: vi.fn().mockResolvedValue(undefined),
  getArticles: vi.fn().mockResolvedValue({
    items: [
      {
        id: 1,
        feedId: 1,
        guid: "https://example.com/article-1",
        title: "Soja dispara no mercado internacional",
        description: "Preços da soja sobem 3% após relatório do USDA.",
        link: "https://example.com/article-1",
        source: "Notícias Agrícolas",
        category: "mercado",
        publishedAt: new Date(),
        createdAt: new Date(),
      },
    ],
    total: 1,
  }),
  getArticleStats: vi.fn().mockResolvedValue({
    total: 42,
    today: 5,
    byCategory: [
      { category: "mercado", total: 20 },
      { category: "clima", total: 10 },
    ],
    bySource: [
      { source: "Notícias Agrícolas", total: 20 },
      { source: "USDA Blog", total: 22 },
    ],
  }),
  getLatestSummary: vi.fn().mockResolvedValue({
    id: 1,
    summaryDate: new Date(),
    content: "## Resumo do Dia\n\nMercado de soja em alta...",
    highlights: JSON.stringify([
      { title: "Soja em alta", description: "Preços sobem 3%", category: "mercado" },
    ]),
    articleCount: 42,
    generatedAt: new Date(),
    updatedAt: new Date(),
  }),
  getSummaryByDate: vi.fn().mockResolvedValue(null),
  getRecentSummaries: vi.fn().mockResolvedValue([]),
  getRecentJobLogs: vi.fn().mockResolvedValue([
    {
      id: 1,
      jobName: "rss_fetch",
      status: "success",
      message: "Busca concluída: 5 novos artigos",
      articlesAdded: 5,
      startedAt: new Date(),
      finishedAt: new Date(),
    },
  ]),
  seedDefaultFeeds: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./jobs", () => ({
  runFetchJob: vi.fn().mockResolvedValue({ articlesAdded: 3, message: "Job concluído" }),
  getJobStatus: vi.fn().mockReturnValue({
    lastRun: new Date(),
    nextRun: new Date(Date.now() + 6 * 60 * 60 * 1000),
    lastStatus: "success",
    lastMessage: "Busca concluída: 3 novos artigos",
    articlesAdded: 3,
  }),
  startJobScheduler: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./commodities", () => ({
  fetchAndSaveAllQuotes: vi.fn().mockResolvedValue([
    { symbol: "ZS=F", name: "Soja",           flag: "🌱", unit: "USX/bu",  price: 1203.25, prevClose: 1163.75, change: 39.50,  changePct: 3.39,  currency: "USX", exchange: "CBT", fetchedAt: new Date() },
    { symbol: "ZC=F", name: "Milho",          flag: "🌽", unit: "USX/bu",  price: 453.75,  prevClose: 441.50,  change: 12.25,  changePct: 2.77,  currency: "USX", exchange: "CBT", fetchedAt: new Date() },
    { symbol: "ZW=F", name: "Trigo",          flag: "🌾", unit: "USX/bu",  price: 593.00,  prevClose: 582.75,  change: 10.25,  changePct: 1.76,  currency: "USX", exchange: "CBT", fetchedAt: new Date() },
    { symbol: "CT=F", name: "Algodão",        flag: "🪡", unit: "USX/lb",  price: 65.14,   prevClose: 65.30,   change: -0.16,  changePct: -0.24, currency: "USX", exchange: "NYM", fetchedAt: new Date() },
    { symbol: "LE=F", name: "Boi Gordo",      flag: "🐄", unit: "USX/cwt", price: 224.68,  prevClose: 225.38,  change: -0.70,  changePct: -0.31, currency: "USX", exchange: "CME", fetchedAt: new Date() },
    { symbol: "GF=F", name: "Boi Alimentado", flag: "🐂", unit: "USX/cwt", price: 325.35,  prevClose: 327.73,  change: -2.38,  changePct: -0.72, currency: "USX", exchange: "CME", fetchedAt: new Date() },
  ]),
  getLatestQuotes: vi.fn().mockResolvedValue([
    { symbol: "ZS=F", name: "Soja",           flag: "🌱", unit: "USX/bu",  price: 1203.25, prevClose: 1163.75, change: 39.50,  changePct: 3.39,  currency: "USX", exchange: "CBT", fetchedAt: new Date() },
    { symbol: "ZC=F", name: "Milho",          flag: "🌽", unit: "USX/bu",  price: 453.75,  prevClose: 441.50,  change: 12.25,  changePct: 2.77,  currency: "USX", exchange: "CBT", fetchedAt: new Date() },
    { symbol: "ZW=F", name: "Trigo",          flag: "🌾", unit: "USX/bu",  price: 593.00,  prevClose: 582.75,  change: 10.25,  changePct: 1.76,  currency: "USX", exchange: "CBT", fetchedAt: new Date() },
    { symbol: "CT=F", name: "Algodão",        flag: "🪡", unit: "USX/lb",  price: 65.14,   prevClose: 65.30,   change: -0.16,  changePct: -0.24, currency: "USX", exchange: "NYM", fetchedAt: new Date() },
    { symbol: "LE=F", name: "Boi Gordo",      flag: "🐄", unit: "USX/cwt", price: 224.68,  prevClose: 225.38,  change: -0.70,  changePct: -0.31, currency: "USX", exchange: "CME", fetchedAt: new Date() },
    { symbol: "GF=F", name: "Boi Alimentado", flag: "🐂", unit: "USX/cwt", price: 325.35,  prevClose: 327.73,  change: -2.38,  changePct: -0.72, currency: "USX", exchange: "CME", fetchedAt: new Date() },
  ]),
  getStoredHistory: vi.fn().mockResolvedValue([]),
  fetchHistory: vi.fn().mockResolvedValue([]),
  COMMODITIES: [
    { symbol: "ZS=F", name: "Soja",           flag: "🌱", unit: "USX/bu"  },
    { symbol: "ZC=F", name: "Milho",          flag: "🌽", unit: "USX/bu"  },
    { symbol: "ZW=F", name: "Trigo",          flag: "🌾", unit: "USX/bu"  },
    { symbol: "CT=F", name: "Algodão",        flag: "🪡", unit: "USX/lb"  },
    { symbol: "LE=F", name: "Boi Gordo",      flag: "🐄", unit: "USX/cwt" },
    { symbol: "GF=F", name: "Boi Alimentado", flag: "🐂", unit: "USX/cwt" },
  ],
}));

vi.mock("./summarizer", () => ({
  generateDailySummary: vi.fn().mockResolvedValue({
    content: "## Resumo\n\nConteúdo gerado pela IA",
    highlights: "[]",
    articleCount: 10,
  }),
}));

// ─── Test context ─────────────────────────────────────────────────────────────
function createPublicCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createAuthCtx(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("feeds.list", () => {
  it("returns list of feeds without authentication", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const feeds = await caller.feeds.list();
    expect(feeds).toHaveLength(2);
    expect(feeds[0].name).toBe("Notícias Agrícolas");
    expect(feeds[1].active).toBe(false);
  });
});

describe("feeds.add", () => {
  it("requires authentication", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    await expect(
      caller.feeds.add({ name: "Test", url: "https://test.com/rss", category: "geral" })
    ).rejects.toThrow();
  });

  it("adds a feed when authenticated", async () => {
    const caller = appRouter.createCaller(createAuthCtx());
    const result = await caller.feeds.add({
      name: "Test Feed",
      url: "https://test.com/rss",
      category: "mercado",
    });
    expect(result.success).toBe(true);
  });
});

describe("feeds.toggleActive", () => {
  it("requires authentication", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    await expect(caller.feeds.toggleActive({ id: 1, active: false })).rejects.toThrow();
  });

  it("toggles feed active status when authenticated", async () => {
    const caller = appRouter.createCaller(createAuthCtx());
    const result = await caller.feeds.toggleActive({ id: 1, active: false });
    expect(result.success).toBe(true);
  });
});

describe("articles.list", () => {
  it("returns articles without authentication", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const result = await caller.articles.list({ limit: 10, offset: 0 });
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.items[0].title).toBe("Soja dispara no mercado internacional");
  });

  it("accepts category filter", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const result = await caller.articles.list({
      categories: ["mercado"],
      limit: 10,
      offset: 0,
    });
    expect(result).toBeDefined();
  });
});

describe("articles.stats", () => {
  it("returns stats without authentication", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const stats = await caller.articles.stats();
    expect(stats.total).toBe(42);
    expect(stats.today).toBe(5);
    expect(stats.byCategory).toHaveLength(2);
  });
});

describe("summaries.latest", () => {
  it("returns latest summary without authentication", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const summary = await caller.summaries.latest();
    expect(summary).not.toBeNull();
    expect(summary?.content).toContain("Resumo do Dia");
    expect(summary?.articleCount).toBe(42);
  });
});

describe("summaries.generate", () => {
  it("requires authentication", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    await expect(caller.summaries.generate({})).rejects.toThrow();
  });

  it("generates summary when authenticated", async () => {
    const caller = appRouter.createCaller(createAuthCtx());
    const result = await caller.summaries.generate({});
    expect(result.content).toContain("Resumo");
    expect(result.articleCount).toBe(10);
  });
});

describe("jobs.status", () => {
  it("returns job status without authentication", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const status = await caller.jobs.status();
    expect(status.lastStatus).toBe("success");
    expect(status.articlesAdded).toBe(3);
  });
});

describe("jobs.runNow", () => {
  it("requires authentication", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    await expect(caller.jobs.runNow()).rejects.toThrow();
  });

  it("runs job when authenticated", async () => {
    const caller = appRouter.createCaller(createAuthCtx());
    const result = await caller.jobs.runNow();
    expect(result.articlesAdded).toBe(3);
    expect(result.message).toBe("Job concluído");
  });
});

describe("jobs.logs", () => {
  it("returns job logs without authentication", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const logs = await caller.jobs.logs({ limit: 10 });
    expect(logs).toHaveLength(1);
    expect(logs[0].status).toBe("success");
  });
});

describe("commodities.quotes", () => {
  it("returns latest quotes without authentication", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const quotes = await caller.commodities.quotes();
    expect(quotes).toHaveLength(6);
    expect(quotes[0].symbol).toBe("ZS=F");
    expect(quotes[0].name).toBe("Soja");
    expect(quotes[0].price).toBe(1203.25);
    expect(quotes[0].changePct).toBeCloseTo(3.39);
    expect(quotes[3].symbol).toBe("CT=F");
    expect(quotes[3].name).toBe("Algodão");
    expect(quotes[4].symbol).toBe("LE=F");
    expect(quotes[5].symbol).toBe("GF=F");
  });
});

describe("commodities.list", () => {
  it("returns list of available commodities", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const list = await caller.commodities.list();
    expect(list).toHaveLength(6);
    expect(list.map((c) => c.symbol)).toEqual(["ZS=F", "ZC=F", "ZW=F", "CT=F", "LE=F", "GF=F"]);
  });
});

describe("commodities.refresh", () => {
  it("requires authentication", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    await expect(caller.commodities.refresh()).rejects.toThrow();
  });

  it("refreshes quotes when authenticated", async () => {
    const caller = appRouter.createCaller(createAuthCtx());
    const quotes = await caller.commodities.refresh();
    expect(quotes).toHaveLength(6);
    expect(quotes[1].symbol).toBe("ZC=F");
    expect(quotes[2].name).toBe("Trigo");
    expect(quotes[3].symbol).toBe("CT=F");
    expect(quotes[4].name).toBe("Boi Gordo");
  });
});

describe("commodities.history", () => {
  it("returns historical data for a symbol", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const history = await caller.commodities.history({ symbol: "ZS=F", range: "1mo" });
    expect(Array.isArray(history)).toBe(true);
  });
});
