export type {
  Provenance,
  MarketSnapshotData,
  MarketDataProvider,
  GitHubRepoMeta,
  GitHubProvider,
} from "./types";
export { GeckoTerminalProvider, geckoTerminal } from "./geckoterminal";

export const CONNECTOR_STUBS = {
  market: ["geckoterminal", "coingecko"] as const,
  github: ["github_api"] as const,
  onchain: ["base_explorer", "rpc"] as const,
  packages: ["npm"] as const,
};
