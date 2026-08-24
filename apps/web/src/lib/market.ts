/**
 * Fetch market data from GeckoTerminal and append market_snapshots rows.
 * Never invent numbers — null when GT has no pool/data.
 */

import { geckoTerminal } from "@codexcap/connectors";
import { activitySignals, marketSnapshots, tokens } from "@codexcap/db/schema";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";

function toNumericString(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  return String(n);
}

export type RefreshResult = {
  tokenId: string;
  symbol: string | null;
  ok: boolean;
  marketCap: number | null;
  liquidityUsd: number | null;
  volume24h: number | null;
  error?: string;
};

export async function refreshTokenMarket(tokenId: string): Promise<RefreshResult> {
  const database = db();
  const [token] = await database.select().from(tokens).where(eq(tokens.id, tokenId)).limit(1);
  if (!token) {
    return {
      tokenId,
      symbol: null,
      ok: false,
      marketCap: null,
      liquidityUsd: null,
      volume24h: null,
      error: "token not found",
    };
  }
  if (!token.contractAddress) {
    return {
      tokenId,
      symbol: token.symbol,
      ok: false,
      marketCap: null,
      liquidityUsd: null,
      volume24h: null,
      error: "no contract address",
    };
  }

  try {
    const data = await geckoTerminal.getTokenMarket(token.chainId, token.contractAddress);
    if (!data) {
      return {
        tokenId,
        symbol: token.symbol,
        ok: false,
        marketCap: null,
        liquidityUsd: null,
        volume24h: null,
        error: "no data from provider",
      };
    }

    await database.insert(marketSnapshots).values({
      tokenId: token.id,
      timestamp: data.provenance.fetchedAt,
      priceUsd: toNumericString(data.priceUsd),
      marketCap: toNumericString(data.marketCap),
      fdv: toNumericString(data.fdv),
      liquidityUsd: toNumericString(data.liquidityUsd),
      volume24h: toNumericString(data.volume24h),
      source: data.provenance.provider,
      sourceUrl: data.provenance.sourceUrl ?? null,
    });

    // Market activity signal
    const existing = await database
      .select()
      .from(activitySignals)
      .where(and(eq(activitySignals.projectId, token.projectId), eq(activitySignals.signalType, "market")))
      .limit(1);

    const summaryParts = [
      data.marketCap != null ? `mcap $${Math.round(data.marketCap).toLocaleString()}` : "mcap n/a",
      data.liquidityUsd != null ? `liq $${Math.round(data.liquidityUsd).toLocaleString()}` : "liq n/a",
    ];
    const signalValues = {
      latestAt: data.provenance.fetchedAt,
      source: data.provenance.provider,
      confidence: data.marketCap != null || data.liquidityUsd != null ? 7 : 3,
      summary: summaryParts.join(" · "),
      updatedAt: new Date(),
    };
    if (existing[0]) {
      await database.update(activitySignals).set(signalValues).where(eq(activitySignals.id, existing[0].id));
    } else {
      await database.insert(activitySignals).values({
        projectId: token.projectId,
        signalType: "market",
        ...signalValues,
      });
    }

    return {
      tokenId,
      symbol: token.symbol,
      ok: true,
      marketCap: data.marketCap,
      liquidityUsd: data.liquidityUsd,
      volume24h: data.volume24h,
    };
  } catch (e) {
    return {
      tokenId,
      symbol: token.symbol,
      ok: false,
      marketCap: null,
      liquidityUsd: null,
      volume24h: null,
      error: e instanceof Error ? e.message : "fetch failed",
    };
  }
}

export async function refreshAllCurrentTokenMarkets(): Promise<RefreshResult[]> {
  const database = db();
  const rows = await database
    .select()
    .from(tokens)
    .where(and(eq(tokens.isCurrent, true), isNotNull(tokens.contractAddress)));

  const results: RefreshResult[] = [];
  for (const t of rows) {
    results.push(await refreshTokenMarket(t.id));
    // polite pacing for public GT API
    await new Promise((r) => setTimeout(r, 400));
  }
  return results;
}

export async function latestSnapshotsByTokenIds(tokenIds: string[]) {
  if (tokenIds.length === 0) return new Map<string, typeof marketSnapshots.$inferSelect>();
  const database = db();
  const rows = await database
    .select()
    .from(marketSnapshots)
    .where(inArray(marketSnapshots.tokenId, tokenIds))
    .orderBy(desc(marketSnapshots.timestamp));

  const map = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (!map.has(row.tokenId)) map.set(row.tokenId, row);
  }
  return map;
}
