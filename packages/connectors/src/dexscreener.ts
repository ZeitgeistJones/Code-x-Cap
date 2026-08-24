/**
 * DexScreener public API — no key. Used as market fallback when GeckoTerminal is thin.
 * Docs: https://docs.dexscreener.com/api/reference
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

function pickBestPair(pairs: DsPair[], tokenAddress: string): DsPair | null {
  const addr = tokenAddress.toLowerCase();
  const relevant = pairs.filter(
    (p) => (p.baseToken?.address ?? "").toLowerCase() === addr || !p.baseToken?.address,
  );
  const pool = (relevant.length ? relevant : pairs)
    .map((p) => ({ p, liq: num(p.liquidity?.usd) ?? 0 }))
    .sort((a, b) => b.liq - a.liq);
  return pool[0]?.p ?? null;
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

    const sourceUrl = `${DS_BASE}/token-pairs/v1/${network}/${address}`;
    const res = await fetch(sourceUrl, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

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

    if (!res.ok) {
      throw new Error(`DexScreener ${res.status}: ${await res.text().catch(() => "")}`);
    }

    const json = (await res.json()) as DsPair[] | { pairs?: DsPair[] };
    const pairs = Array.isArray(json) ? json : (json.pairs ?? []);
    if (!pairs.length) {
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

    const best = pickBestPair(pairs, address);
    if (!best) return null;

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
