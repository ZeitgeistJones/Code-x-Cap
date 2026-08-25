/**
 * DexScreener public API — no key. Used as market fallback when GeckoTerminal is thin.
 * Docs: https://docs.dexscreener.com/api/reference
 *
 * Prefer /token-pairs/v1/{chain}/{token}; if empty, fall back to /latest/dex/tokens/{token}
 * and keep only pairs on the requested chain (never switch to a same-ticker other token).
 */

import type { MarketDataProvider, MarketSnapshotData, Provenance } from "./types";

const DS_BASE = "https://api.dexscreener.com";

const CHAIN_TO_DS: Record<number, string> = {
  1: "ethereum",
  8453: "base",
  42161: "arbitrum",
  10: "optimism",
  56: "bsc",
  137: "polygon",
};

interface DsPair {
  chainId?: string;
  url?: string;
  priceUsd?: string;
  marketCap?: number;
  fdv?: number;
  liquidity?: { usd?: number };
  volume?: { h24?: number };
  txns?: { h24?: { buys?: number; sells?: number } };
  baseToken?: { address?: string };
}

function num(v: string | number | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function pickBestPair(pairs: DsPair[], tokenAddress: string, network: string): DsPair | null {
  const addr = tokenAddress.toLowerCase();
  const onChain = pairs.filter((p) => (p.chainId ?? "").toLowerCase() === network);
  const pool = (onChain.length ? onChain : pairs).filter(
    (p) => (p.baseToken?.address ?? "").toLowerCase() === addr,
  );
  const ranked = (pool.length ? pool : onChain.length ? onChain : pairs)
    .map((p) => ({ p, liq: num(p.liquidity?.usd) ?? 0 }))
    .sort((a, b) => b.liq - a.liq);
  return ranked[0]?.p ?? null;
}

function emptyResult(provider: string, sourceUrl: string): MarketSnapshotData & { provenance: Provenance } {
  return {
    priceUsd: null,
    marketCap: null,
    fdv: null,
    liquidityUsd: null,
    volume24h: null,
    provenance: {
      provider,
      sourceUrl,
      fetchedAt: new Date(),
    },
  };
}

export class DexScreenerProvider implements MarketDataProvider {
  readonly name = "dexscreener";

  networkForChain(chainId: number): string | null {
    return CHAIN_TO_DS[chainId] ?? null;
  }

  async getTokenMarket(
    chainId: number,
    contractAddress: string,
  ): Promise<(MarketSnapshotData & { provenance: Provenance }) | null> {
    const network = this.networkForChain(chainId);
    if (!network) return null;

    const address = contractAddress.trim().toLowerCase();
    if (!address) return null;

    const pairsUrl = `${DS_BASE}/token-pairs/v1/${network}/${address}`;
    let pairs: DsPair[] = [];
    let sourceUrl = pairsUrl;

    try {
      const res = await fetch(pairsUrl, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (res.ok) {
        const json = (await res.json()) as DsPair[] | { pairs?: DsPair[] };
        pairs = Array.isArray(json) ? json : (json.pairs ?? []);
      }
    } catch {
      // try fallback below
    }

    // token-pairs is often empty for thin Base microcaps — latest/dex/tokens still has pairs
    if (!pairs.length) {
      const latestUrl = `${DS_BASE}/latest/dex/tokens/${address}`;
      sourceUrl = latestUrl;
      try {
        const res = await fetch(latestUrl, {
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        if (res.ok) {
          const json = (await res.json()) as { pairs?: DsPair[] };
          pairs = json.pairs ?? [];
        }
      } catch {
        return emptyResult(this.name, sourceUrl);
      }
    }

    if (!pairs.length) return emptyResult(this.name, sourceUrl);

    const best = pickBestPair(pairs, address, network);
    if (!best) return emptyResult(this.name, sourceUrl);

    const buys = best.txns?.h24?.buys ?? null;
    const sells = best.txns?.h24?.sells ?? null;

    return {
      priceUsd: num(best.priceUsd),
      marketCap: num(best.marketCap),
      fdv: num(best.fdv),
      liquidityUsd: num(best.liquidity?.usd),
      volume24h: num(best.volume?.h24),
      buys24h: buys,
      sells24h: sells,
      provenance: {
        provider: this.name,
        sourceUrl: best.url ?? `https://dexscreener.com/${network}/${address}`,
        fetchedAt: new Date(),
      },
    };
  }
}

export const dexScreener = new DexScreenerProvider();
