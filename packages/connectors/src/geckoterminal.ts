/**
 * GeckoTerminal public API — no key required for basic token lookups.
 * Docs: https://api.geckoterminal.com/docs/index.html
 *
 * Important: token-level market_cap/fdv/price are often null for microcaps.
 * Pool payloads usually still have base_token_price_usd + fdv_usd — use those.
 * Public API rate-limits aggressively — retry once on 429 before soft-failing.
 */

import type { MarketDataProvider, MarketSnapshotData, Provenance } from "./types";

const GT_BASE = "https://api.geckoterminal.com/api/v2";

const CHAIN_TO_NETWORK: Record<number, string> = {
  1: "eth",
  8453: "base",
  42161: "arbitrum",
  10: "optimism",
  56: "bsc",
  137: "polygon",
};

interface GtTokenAttributes {
  price_usd?: string | null;
  fdv_usd?: string | null;
  market_cap_usd?: string | null;
  total_reserve_in_usd?: string | null;
  volume_usd?: { h24?: string | null } | null;
}

interface GtPoolAttributes {
  reserve_in_usd?: string | null;
  base_token_price_usd?: string | null;
  quote_token_price_usd?: string | null;
  fdv_usd?: string | null;
  market_cap_usd?: string | null;
  volume_usd?: { h24?: string | null } | null;
}

function num(v: string | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function gtFetch(url: string): Promise<Response | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (res.status === 429 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
        continue;
      }
      return res;
    } catch {
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  return null;
}

export class GeckoTerminalProvider implements MarketDataProvider {
  readonly name = "geckoterminal";

  networkForChain(chainId: number): string | null {
    return CHAIN_TO_NETWORK[chainId] ?? null;
  }

  async getTokenMarket(
    chainId: number,
    contractAddress: string,
  ): Promise<(MarketSnapshotData & { provenance: Provenance }) | null> {
    const network = this.networkForChain(chainId);
    if (!network) return null;

    const address = contractAddress.trim().toLowerCase();
    if (!address) return null;

    const sourceUrl = `${GT_BASE}/networks/${network}/tokens/${address}`;
    const res = await gtFetch(sourceUrl);
    if (!res) return null;

    if (res.status === 404) {
      return {
        priceUsd: null,
        marketCap: null,
        fdv: null,
        liquidityUsd: null,
        volume24h: null,
        provenance: {
          provider: this.name,
          sourceUrl,
          fetchedAt: new Date(),
        },
      };
    }

    if (!res.ok) return null;

    const json = (await res.json()) as { data?: { attributes?: GtTokenAttributes } };
    const a = json.data?.attributes;
    if (!a) return null;

    let priceUsd = num(a.price_usd);
    let marketCap = num(a.market_cap_usd);
    let fdv = num(a.fdv_usd);
    let liquidityUsd = num(a.total_reserve_in_usd ?? null);
    let volume24h = num(a.volume_usd?.h24);

    // Pool fallback — only when valuation/price/liq are actually missing.
    const hasValuation = marketCap != null || fdv != null;
    const needsPool =
      !hasValuation || priceUsd == null || liquidityUsd == null || liquidityUsd < 500;

    if (needsPool) {
      const poolsUrl = `${GT_BASE}/networks/${network}/tokens/${address}/pools?page=1`;
      const poolsRes = await gtFetch(poolsUrl);
      if (poolsRes?.ok) {
        try {
          const poolsJson = (await poolsRes.json()) as {
            data?: Array<{ attributes?: GtPoolAttributes }>;
          };
          const ranked = (poolsJson.data ?? [])
            .map((p) => ({
              attrs: p.attributes ?? {},
              reserve: num(p.attributes?.reserve_in_usd) ?? 0,
            }))
            .sort((x, y) => y.reserve - x.reserve);

          const best = ranked[0]?.attrs;
          if (best) {
            const poolPrice = num(best.base_token_price_usd);
            const poolFdv = num(best.fdv_usd);
            const poolMcap = num(best.market_cap_usd);
            const poolLiq = num(best.reserve_in_usd);
            const poolVol = num(best.volume_usd?.h24);

            if (priceUsd == null && poolPrice != null) priceUsd = poolPrice;
            if (fdv == null && poolFdv != null) fdv = poolFdv;
            if (marketCap == null && poolMcap != null) marketCap = poolMcap;
            if (poolLiq != null && (liquidityUsd == null || poolLiq > liquidityUsd)) {
              liquidityUsd = poolLiq;
            }
            if (volume24h == null && poolVol != null) volume24h = poolVol;
          }
        } catch {
          // keep token-level
        }
      }
    }

    if (marketCap == null && fdv != null) marketCap = fdv;

    return {
      priceUsd,
      marketCap,
      fdv,
      liquidityUsd,
      volume24h,
      provenance: {
        provider: this.name,
        sourceUrl: `https://www.geckoterminal.com/${network}/tokens/${address}`,
        fetchedAt: new Date(),
      },
    };
  }
}

export const geckoTerminal = new GeckoTerminalProvider();
