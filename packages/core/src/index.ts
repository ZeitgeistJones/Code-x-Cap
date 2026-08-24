/** Domain enums, recency helpers, slug utils — shared across web/worker/db. */

export const DISCOVERY_TIERS = [
  "under_the_radar",
  "niche_known",
  "established",
  "benchmark",
] as const;
export type DiscoveryTier = (typeof DISCOVERY_TIERS)[number];

export const PROJECT_STATUSES = [
  "candidate",
  "researching",
  "pass",
  "watch",
  "pre_token",
  "pre_market",
  "migration",
  "unverified",
  "dormant",
  "rejected",
  "archived",
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PRIMARY_CATEGORIES = [
  "agent_infrastructure",
  "agent_economy",
  "agent_defi",
  "data_intelligence",
  "developer_infrastructure",
  "consumer_agent",
  "other",
] as const;
export type PrimaryCategory = (typeof PRIMARY_CATEGORIES)[number];

export const TOKEN_STATUSES = [
  "announced",
  "deployed_no_market",
  "trading",
  "low_liquidity",
  "migration_pending",
  "deprecated",
  "abandoned",
  "unknown",
] as const;
export type TokenStatus = (typeof TOKEN_STATUSES)[number];

export const TOKEN_ROLES = [
  "primary",
  "legacy",
  "bridge",
  "utility",
  "governance",
  "other",
] as const;
export type TokenRole = (typeof TOKEN_ROLES)[number];

export const REPO_ROLES = [
  "core",
  "backend",
  "frontend",
  "sdk",
  "contracts",
  "mcp",
  "cli",
  "docs",
  "deployment",
  "experimental",
] as const;
export type RepoRole = (typeof REPO_ROLES)[number];

export const ACTIVITY_SIGNAL_TYPES = [
  "code",
  "product",
  "onchain",
  "market",
  "social",
  "docs",
] as const;
export type ActivitySignalType = (typeof ACTIVITY_SIGNAL_TYPES)[number];

export const SCORE_DIMENSIONS = [
  "identity_confidence",
  "build_substance",
  "development_momentum",
  "product_reality",
  "market_quality",
  "external_adoption",
  "trust_security",
  "asymmetry",
] as const;
export type ScoreDimension = (typeof SCORE_DIMENSIONS)[number];

export const COMMIT_CLASSIFICATIONS = [
  "substantive_feature",
  "substantive_fix",
  "contract_work",
  "SDK_API",
  "test_infrastructure",
  "deployment",
  "documentation",
  "dependency_update",
  "formatting",
  "generated",
  "README_only",
  "unknown",
] as const;
export type CommitClassification = (typeof COMMIT_CLASSIFICATIONS)[number];

export const EVENT_TYPES = [
  "meaningful_commit",
  "release",
  "new_repo",
  "product_launch",
  "token_announced",
  "token_deployed",
  "liquidity_created",
  "liquidity_removed",
  "token_migration",
  "contract_changed",
  "market_cap_threshold",
  "liquidity_threshold",
  "x402_activity",
  "package_release",
  "website_down",
  "repo_private",
  "repo_deleted",
  "dormant",
  "reactivated",
  "security_change",
  "admin_power_detected",
  "manual_note",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_SEVERITIES = ["info", "low", "medium", "high", "critical"] as const;
export type EventSeverity = (typeof EVENT_SEVERITIES)[number];

export const TAG_GROUPS = [
  "agent_infrastructure",
  "agent_economy",
  "agent_defi",
  "data_intelligence",
  "developer_infrastructure",
  "product_type",
  "situation",
] as const;
export type TagGroup = (typeof TAG_GROUPS)[number];

/** Common chains for Phase 1 manual entry. */
export const CHAINS = [
  { id: 8453, slug: "base", name: "Base" },
  { id: 1, slug: "ethereum", name: "Ethereum" },
  { id: 42161, slug: "arbitrum", name: "Arbitrum" },
  { id: 10, slug: "optimism", name: "Optimism" },
  { id: 56, slug: "bsc", name: "BNB Chain" },
  { id: 137, slug: "polygon", name: "Polygon" },
  { id: 0, slug: "solana", name: "Solana" },
  { id: -1, slug: "other", name: "Other" },
] as const;

export type RecencyBadge = "hot" | "active" | "cooling" | "dormant" | "unknown";

export const RECENCY_THRESHOLDS = {
  hotDays: 7,
  activeDays: 30,
  coolingDays: 60,
} as const;

export function daysSince(date: Date | string | null | undefined, now = new Date()): number | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export function recencyBadge(
  latestAt: Date | string | null | undefined,
  now = new Date(),
  thresholds = RECENCY_THRESHOLDS,
): RecencyBadge {
  const days = daysSince(latestAt, now);
  if (days === null) return "unknown";
  if (days <= thresholds.hotDays) return "hot";
  if (days <= thresholds.activeDays) return "active";
  if (days <= thresholds.coolingDays) return "cooling";
  return "dormant";
}

export const RECENCY_LABELS: Record<RecencyBadge, string> = {
  hot: "HOT",
  active: "ACTIVE",
  cooling: "COOLING",
  dormant: "DORMANT",
  unknown: "UNKNOWN",
};

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Basic EVM address check (not checksum validation). */
export function isLikelyEvmAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

export function formatCategory(c: PrimaryCategory | string): string {
  return c.replace(/_/g, " ");
}

export function formatStatus(s: string): string {
  return s.replace(/_/g, " ");
}

export function formatUsdCompact(value: number | string | null | undefined): string {
  if (value == null || value === "") return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return "$0";
  if (n < 1000) return `$${n.toFixed(n < 1 ? 4 : 2)}`;
  if (n < 1_000_000) return `$${(n / 1_000).toFixed(1)}K`;
  if (n < 1_000_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  return `$${(n / 1_000_000_000).toFixed(2)}B`;
}
