export type {
  Provenance,
  MarketSnapshotData,
  MarketDataProvider,
  GitHubRepoMeta,
  GitHubProvider,
} from "./types";
export { GeckoTerminalProvider, geckoTerminal } from "./geckoterminal";
export { DexScreenerProvider, dexScreener } from "./dexscreener";
export { GitHubApiProvider, githubApi } from "./github";
export type { GitHubCommitDetail } from "./github";

export const CONNECTOR_STUBS = {
  market: ["geckoterminal", "dexscreener", "coingecko"] as const,
  github: ["github_api"] as const,
  onchain: ["base_explorer", "rpc"] as const,
  packages: ["npm"] as const,
};
