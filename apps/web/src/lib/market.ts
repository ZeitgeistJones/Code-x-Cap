/**
 * Fetch market data: GeckoTerminal primary, DexScreener fills gaps.
 * Never invent numbers — null when no pool/data. No CA → skip.
 */

import { dexScreener, geckoTerminal } from "@codexcap/connectors";
import type { MarketSnapshotData, Provenance } from "@codexcap/connectors";
import { activitySignals, marketSnapshots, projects, tokens } from "@codexcap/db/schema";
import { and, desc, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";
import { db } from "@/lib/db";

function toNumericString(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  return String(n);
}

function hasUsefulMarket(d: MarketSnapshotData | null | undefined): boolean {
  if (!d) return false;
  return d.marketCap != null || d.liquidityUsd != null || d.priceUsd != null || d.fdv != null;
}

function mergeMarket(
  primary: (MarketSnapshotData & { provenance: Provenance }) | null,
  fallback: (MarketSnapshotData & { provenance: Provenance }) | null,
): (MarketSnapshotData & { provenance: Provenance }) | null {
  if (!primary && !fallback) return null;
  if (!primary) return fallback;
  if (!fallback) return primary;

  const usedFallback =
    (primary.marketCap == null && fallback.marketCap != null) ||
    (primary.fdv == null && fallback.fdv != null) ||
    (primary.liquidityUsd == null && fallback.liquidityUsd != null) ||
    (primary.priceUsd == null && fallback.priceUsd != null) ||
    (primary.volume24h == null && fallback.volume24h != null);

  const providers = usedFallback
    ? `${primary.provenance.provider}+${fallback.provenance.provider}`
    : primary.provenance.provider;

  return {
    priceUsd: primary.priceUsd ?? fallback.priceUsd,
    marketCap: primary.marketCap ?? fallback.marketCap,
    fdv: primary.fdv ?? fallback.fdv,
    liquidityUsd: primary.liquidityUsd ?? fallback.liquidityUsd,
    volume24h: primary.volume24h ?? fallback.volume24h,
    buys24h: primary.buys24h ?? fallback.buys24h,
    sells24h: primary.sells24h ?? fallback.sells24h,
    provenance: {
      provider: providers,
      sourceUrl: usedFallback
        ? (fallback.provenance.sourceUrl ?? primary.provenance.sourceUrl)
        : primary.provenance.sourceUrl,
      fetchedAt: new Date(),
    },
  };
}

export type RefreshResult = {
  tokenId: string;
  symbol: string | null;
  ok: boolean;
  marketCap: number | null;
  liquidityUsd: number | null;
  volume24h: number | null;
  source?: string;
  error?: string;
};

export type RefreshAllSummary = {
  results: RefreshResult[];
  skippedNoCa: Array<{ symbol: string | null; projectName: string | null }>;
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
    let gt: Awaited<ReturnType<typeof geckoTerminal.getTokenMarket>> = null;
    let ds: Awaited<ReturnType<typeof dexScreener.getTokenMarket>> = null;

    try {
      gt = await geckoTerminal.getTokenMarket(token.chainId, token.contractAddress);
    } catch (e) {
      console.warn("geckoterminal failed", token.symbol, e instanceof Error ? e.message : e);
    }

    // Always try DexScreener when GT is missing or thin on mcap/fdv/liquidity
    const needsFallback =
      !hasUsefulMarket(gt) || gt?.marketCap == null || gt?.liquidityUsd == null || gt?.fdv == null;

    if (needsFallback) {
      try {
        ds = await dexScreener.getTokenMarket(token.chainId, token.contractAddress);
      } catch (e) {
        console.warn("dexscreener failed", token.symbol, e instanceof Error ? e.message : e);
      }
    }

    const data = mergeMarket(gt, ds);
    if (!data || !hasUsefulMarket(data)) {
      return {
        tokenId,
        symbol: token.symbol,
        ok: false,
        marketCap: null,
        liquidityUsd: null,
        volume24h: null,
        error: "no pool/market data from geckoterminal or dexscreener",
      };
    }

    // Prefer explicit mcap; else FDV (common for Base microcaps where circulating mcap is unset)
    const valuation = data.marketCap ?? data.fdv ?? null;

    await database.insert(marketSnapshots).values({
      tokenId: token.id,
      timestamp: data.provenance.fetchedAt,
      priceUsd: toNumericString(data.priceUsd),
      marketCap: toNumericString(valuation),
      fdv: toNumericString(data.fdv),
      liquidityUsd: toNumericString(data.liquidityUsd),
      volume24h: toNumericString(data.volume24h),
      buys24h: data.buys24h ?? null,
      sells24h: data.sells24h ?? null,
      source: data.provenance.provider,
      sourceUrl: data.provenance.sourceUrl ?? null,
    });

    const existing = await database
      .select()
      .from(activitySignals)
      .where(and(eq(activitySignals.projectId, token.projectId), eq(activitySignals.signalType, "market")))
      .limit(1);

    const summaryParts = [
      valuation != null ? `mcap $${Math.round(valuation).toLocaleString()}` : "mcap n/a",
      data.liquidityUsd != null ? `liq $${Math.round(data.liquidityUsd).toLocaleString()}` : "liq n/a",
      data.provenance.provider,
    ];
    const signalValues = {
      latestAt: data.provenance.fetchedAt,
      source: data.provenance.provider,
      confidence: valuation != null || data.liquidityUsd != null ? 7 : 3,
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
      marketCap: valuation,
      liquidityUsd: data.liquidityUsd,
      volume24h: data.volume24h,
      source: data.provenance.provider,
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

export async function refreshAllCurrentTokenMarkets(): Promise<RefreshAllSummary> {
  const database = db();
  const withCa = await database
    .select()
    .from(tokens)
    .where(and(eq(tokens.isCurrent, true), isNotNull(tokens.contractAddress)));

  const withoutCa = await database
    .select({
      symbol: tokens.symbol,
      projectName: projects.name,
    })
    .from(tokens)
    .innerJoin(projects, eq(tokens.projectId, projects.id))
    .where(
      and(
        eq(tokens.isCurrent, true),
        or(isNull(tokens.contractAddress), eq(tokens.contractAddress, "")),
      ),
    );

  const results: RefreshResult[] = [];
  for (const t of withCa) {
    results.push(await refreshTokenMarket(t.id));
    // polite pacing for public APIs
    await new Promise((r) => setTimeout(r, 350));
  }
  return {
    results,
    skippedNoCa: withoutCa.map((r) => ({
      symbol: r.symbol,
      projectName: r.projectName,
    })),
  };
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
