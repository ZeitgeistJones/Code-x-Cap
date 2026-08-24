/**
 * GeckoTerminal public API — no key required for basic token lookups.
 * Docs: https://api.geckoterminal.com/docs/index.html
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

function num(v: string | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
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
      throw new Error(`GeckoTerminal ${res.status}: ${await res.text().catch(() => "")}`);
    }

    const json = (await res.json()) as { data?: { attributes?: GtTokenAttributes } };
    const a = json.data?.attributes;
    if (!a) return null;

    // Liquidity: token endpoint exposes total_reserve_in_usd across pools when available
    let liquidityUsd = num(a.total_reserve_in_usd ?? null);

    // Fallback: top pool reserve
    if (liquidityUsd == null) {
      try {
        const poolsUrl = `${GT_BASE}/networks/${network}/tokens/${address}/pools?page=1`;
        const poolsRes = await fetch(poolsUrl, { headers: { Accept: "application/json" } });
        if (poolsRes.ok) {
          const poolsJson = (await poolsRes.json()) as {
            data?: Array<{ attributes?: { reserve_in_usd?: string } }>;
          };
          const reserves = (poolsJson.data ?? [])
            .map((p) => num(p.attributes?.reserve_in_usd))
            .filter((n): n is number => n != null);
          if (reserves.length) liquidityUsd = Math.max(...reserves);
        }
      } catch {
        // keep null
      }
    }

    return {
      priceUsd: num(a.price_usd),
      marketCap: num(a.market_cap_usd),
      fdv: num(a.fdv_usd),
      liquidityUsd,
      volume24h: num(a.volume_usd?.h24),
      provenance: {
        provider: this.name,
        sourceUrl: `https://www.geckoterminal.com/${network}/tokens/${address}`,
        fetchedAt: new Date(),
      },
    };
  }
}

export const geckoTerminal = new GeckoTerminalProvider();
