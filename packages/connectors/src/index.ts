/**
 * Connector adapter interfaces — business logic must not couple to one API vendor.
 * Implementations (Phase 2+) must record which provider produced each datapoint.
 */

export interface Provenance {
  provider: string;
  sourceUrl?: string;
  fetchedAt: Date;
}

export interface MarketSnapshotData {
  priceUsd: number | null;
  marketCap: number | null;
  fdv: number | null;
  liquidityUsd: number | null;
  volume24h: number | null;
  buys24h?: number | null;
  sells24h?: number | null;
  holderCount?: number | null;
}

export interface MarketDataProvider {
  readonly name: string;
  getTokenMarket(
    chainId: number,
    contractAddress: string,
  ): Promise<(MarketSnapshotData & { provenance: Provenance }) | null>;
}

export interface GitHubRepoMeta {
  owner: string;
  repo: string;
  defaultBranch: string;
  stars: number;
  forks: number;
  openIssues: number;
  latestCommitAt: Date | null;
  archived: boolean;
  privateOrMissing: boolean;
}

export interface GitHubProvider {
  readonly name: string;
  getRepository(owner: string, repo: string): Promise<(GitHubRepoMeta & { provenance: Provenance }) | null>;
}

/** Stubs — wire real providers in later phases. */
export const CONNECTOR_STUBS = {
  market: ["geckoterminal", "coingecko"] as const,
  github: ["github_api"] as const,
  onchain: ["base_explorer", "rpc"] as const,
  packages: ["npm"] as const,
};
