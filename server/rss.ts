import Parser from "rss-parser";
import { getDb } from "./db";
import { articles, rssFeeds } from "../drizzle/schema";
import { eq, inArray } from "drizzle-orm";
import https from "https";
import http from "http";

// ─── Agents ───────────────────────────────────────────────────────────────────
// Some sites block generic RSS bot user-agents; use a realistic browser UA
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

// HTTPS agent that ignores self-signed / expired certificates (for Safras & Mercado)
const relaxedHttpsAgent = new https.Agent({ rejectUnauthorized: false });

// Standard parser with browser-like headers
const parser = new Parser({
  timeout: 15000,
  headers: {
    "User-Agent": BROWSER_UA,
    Accept: "application/rss+xml, application/xml, text/xml, */*",
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    "Cache-Control": "no-cache",
  },
  customFields: {
    item: [
      ["media:content", "mediaContent"],
      ["content:encoded", "contentEncoded"],
      ["dc:creator", "creator"],
    ],
  },
});

// Parser with SSL verification disabled (for sites with certificate issues)
const relaxedParser = new Parser({
  timeout: 15000,
  headers: {
    "User-Agent": BROWSER_UA,
    Accept: "application/rss+xml, application/xml, text/xml, */*",
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
  },
  requestOptions: {
    agent: relaxedHttpsAgent,
  },
  customFields: {
    item: [
      ["media:content", "mediaContent"],
      ["content:encoded", "contentEncoded"],
      ["dc:creator", "creator"],
    ],
  },
});

export type ParsedArticle = {
  guid: string;
  title: string;
  description: string | null;
  link: string | null;
  publishedAt: Date | null;
};

/**
 * Determine if a feed URL needs relaxed SSL verification.
 * Safras & Mercado has certificate chain issues.
 */
function needsRelaxedSSL(url: string): boolean {
  return url.includes("safras.com.br");
}

/**
 * Fetch and parse a single RSS feed URL.
 * Automatically selects the appropriate parser based on the URL.
 */
export async function fetchFeed(url: string): Promise<ParsedArticle[]> {
  const selectedParser = needsRelaxedSSL(url) ? relaxedParser : parser;
  const feed = await selectedParser.parseURL(url);

  return (feed.items ?? []).map((item) => {
    const itemAny = item as unknown as Record<string, unknown>;
    const rawDesc =
      item.contentSnippet ||
      item.summary ||
      item.content ||
      (itemAny["contentEncoded"] as string) ||
      "";

    // Strip HTML tags and trim
    const description = rawDesc
      ? rawDesc.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 2000)
      : null;

    const guid =
      item.guid ||
      (itemAny["id"] as string) ||
      item.link ||
      `${url}::${item.title}`;

    return {
      guid: String(guid).slice(0, 1000),
      title: (item.title || "Sem título").trim().slice(0, 1000),
      description,
      link: item.link ? item.link.slice(0, 1000) : null,
      publishedAt: item.pubDate
        ? new Date(item.pubDate)
        : item.isoDate
          ? new Date(item.isoDate)
          : null,
    };
  });
}

/**
 * Fetch all active feeds and persist new articles to the database.
 * Returns a summary of what was fetched.
 */
export async function fetchAllFeeds(): Promise<{
  totalAdded: number;
  feedResults: Array<{ feedId: number; name: string; added: number; error?: string }>;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const feeds = await db.select().from(rssFeeds).where(eq(rssFeeds.active, true));

  const feedResults: Array<{
    feedId: number;
    name: string;
    added: number;
    error?: string;
  }> = [];
  let totalAdded = 0;

  for (const feed of feeds) {
    try {
      const items = await fetchFeed(feed.url);

      // Collect guids to check for duplicates in bulk
      const guids = items.map((i) => i.guid).filter(Boolean);

      let existingGuids = new Set<string>();
      if (guids.length > 0) {
        const chunkSize = 100;
        for (let i = 0; i < guids.length; i += chunkSize) {
          const chunk = guids.slice(i, i + chunkSize);
          const existing = await db
            .select({ guid: articles.guid })
            .from(articles)
            .where(inArray(articles.guid, chunk));
          existing.forEach((r) => existingGuids.add(r.guid));
        }
      }

      const newItems = items.filter((item) => !existingGuids.has(item.guid));

      if (newItems.length > 0) {
        await db.insert(articles).values(
          newItems.map((item) => ({
            feedId: feed.id,
            guid: item.guid,
            title: item.title,
            description: item.description,
            link: item.link,
            source: feed.name,
            category: feed.category,
            publishedAt: item.publishedAt,
          }))
        );
      }

      // Update lastFetchedAt and reset error count
      await db
        .update(rssFeeds)
        .set({ lastFetchedAt: new Date(), fetchErrorCount: 0 })
        .where(eq(rssFeeds.id, feed.id));

      feedResults.push({ feedId: feed.id, name: feed.name, added: newItems.length });
      totalAdded += newItems.length;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);

      // Increment error count
      await db
        .update(rssFeeds)
        .set({ fetchErrorCount: (feed.fetchErrorCount ?? 0) + 1 })
        .where(eq(rssFeeds.id, feed.id));

      feedResults.push({ feedId: feed.id, name: feed.name, added: 0, error: errorMsg });
      console.error(`[RSS] Error fetching feed "${feed.name}": ${errorMsg}`);
    }
  }

  return { totalAdded, feedResults };
}
