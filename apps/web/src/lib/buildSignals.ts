/**
 * Pure Build Signals classification and copy mapping.
 * No database access: callers provide public evidence already loaded.
 * Copy must name the token relationship explicitly — never generic boilerplate.
 */

export type BuildEvidenceLabel = "strong" | "moderate" | "early" | "insufficient";
export type IdentityLabel = "verified" | "supported" | "unverified";
export type MarketContextLabel = "researchable" | "thin" | "stale" | "unavailable";

export type BuildSignalEventType =
  | "meaningful_commit"
  | "release"
  | "product_launch"
  | "liquidity_threshold"
  | "market_cap_threshold"
  | "token_migration"
  | "repo_private"
  | "dormant";

export interface BuildEvidenceInput {
  eventType: BuildSignalEventType;
  meaningfulScore: number | null;
  meaningfulCommits30d: number;
  verifiedEvent: boolean;
}

export interface IdentityInput {
  identityConfidence: number | null;
  hasExactContract: boolean;
  tokenSourceUrl: string | null;
  contractVerified: boolean;
  hasPublicRepository: boolean;
}

export interface MarketContextInput {
  snapshotAt: Date | string | null;
  liquidityUsd: number | null;
  now?: Date;
}

export interface BuildSignalCopyInput {
  projectName: string;
  eventType: BuildSignalEventType;
  eventTitle: string | null;
  eventDescription: string | null;
  classification: string | null;
  meaningfulScore: number | null;
  commitCount: number | null;
  happenedAt: Date | string;
  shortDescription: string | null;
  trackingReason: string | null;
  identityConfidence: number | null;
  identityLabel: IdentityLabel;
  tokenSymbol: string | null;
  tokenChain: string | null;
  tokenContract: string | null;
  tokenSourceUrl: string | null;
  contractVerified: boolean;
  marketLabel: MarketContextLabel;
  marketCap: number | null;
  liquidityUsd: number | null;
  marketSource: string | null;
  marketSnapshotAt: Date | string | null;
}

export interface BuildSignalCopy {
  whatHappened: string;
  whyItMayMatter: string;
  /** Explicit code ↔ token relationship; never invent a link. */
  tokenRelation: string;
  whatWeDoNotKnow: string;
  whatToWatchNext: string;
}

export type CachedAiExplanation = {
  fingerprint: string;
  model: string | null;
  generatedAt: string;
  source: "gemini";
  copy: BuildSignalCopy;
};

/** Short plain-English meanings for the three labels shown on every card. */
export const BUILD_EVIDENCE_EXPLAIN: Record<BuildEvidenceLabel, string> = {
  strong: "Clear recent public build work",
  moderate: "Some public build work, still early",
  early: "Only a small amount of public build work so far",
  insufficient: "Not enough public build evidence yet",
};

export const IDENTITY_EXPLAIN: Record<IdentityLabel, string> = {
  verified: "Project and token identity look well supported",
  supported: "Identity has some backing, not fully locked down",
  unverified: "We are not confident this is the right project/token yet",
};

export const MARKET_CONTEXT_EXPLAIN: Record<MarketContextLabel, string> = {
  researchable: "Recent market numbers from the exact token contract",
  thin: "Market numbers exist, but the pool looks very small",
  stale: "Latest market snapshot is older than a day",
  unavailable: "No usable market snapshot for this exact contract",
};

const CLASSIFICATION_LANGUAGE: Record<string, string> = {
  feature: "product feature work",
  product_feature: "product feature work",
  substantive_feature: "product feature work",
  bug_fix: "bug-fix / reliability work",
  substantive_fix: "bug-fix / reliability work",
  test: "testing / reliability work",
  testing: "testing / reliability work",
  test_infrastructure: "testing / reliability work",
  integration: "developer integration work",
  sdk: "developer integration work",
  sdk_api: "developer integration work",
  api: "developer integration work",
  contract: "on-chain contract work",
  contract_work: "on-chain contract work",
  smart_contract: "on-chain contract work",
  migration: "token / contract migration work",
  deployment: "shipping / infrastructure work",
  devops: "shipping / infrastructure work",
  infrastructure: "shipping / infrastructure work",
  build_work: "build work",
};

const CONTRACT_LIKE = new Set([
  "contract",
  "contract_work",
  "smart_contract",
  "migration",
  "deployment",
]);

const EVENT_PLAIN: Record<BuildSignalEventType, string> = {
  meaningful_commit: "meaningful public code change",
  release: "public software release",
  product_launch: "public product launch note",
  liquidity_threshold: "liquidity change around the exact token contract",
  market_cap_threshold: "market-size change around the exact token contract",
  token_migration: "token migration notice",
  repo_private: "repository becoming private or unavailable",
  dormant: "long quiet stretch in public build activity",
};

function classificationKey(value: string | null): string {
  if (!value) return "build_work";
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function normalizeClassification(value: string | null): string {
  const key = classificationKey(value);
  return CLASSIFICATION_LANGUAGE[key] ?? "build work";
}

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "an unknown date";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "an unknown date";
  return date.toISOString().slice(0, 10);
}

function formatUsd(value: number | null): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${Math.round(value).toLocaleString()}`;
}

function tokenName(input: BuildSignalCopyInput): string {
  if (input.tokenSymbol?.trim()) return `$${input.tokenSymbol.trim()}`;
  return "this project’s token";
}

function marketSnippet(input: BuildSignalCopyInput): string | null {
  if (!input.tokenContract?.trim()) return null;
  if (input.marketLabel === "unavailable" || (!input.marketCap && !input.liquidityUsd)) {
    return "No fresh market snapshot for this contract.";
  }
  const parts = [
    formatUsd(input.marketCap) ? `${formatUsd(input.marketCap)} mcap` : null,
    formatUsd(input.liquidityUsd) ? `${formatUsd(input.liquidityUsd)} liq` : null,
  ].filter(Boolean);
  if (parts.length === 0) return null;
  if (input.marketLabel === "stale") return `${parts.join(" · ")} (stale)`;
  if (input.marketLabel === "thin") return `${parts.join(" · ")} (thin pool)`;
  return parts.join(" · ");
}

function tokenRelationCopy(input: BuildSignalCopyInput): string {
  const name = tokenName(input);
  const classKey = classificationKey(input.classification);
  const evidenceKind = normalizeClassification(input.classification);

  if (input.eventType === "token_migration") {
    return `Direct token migration signal for ${name}. Recheck the destination contract against the source.`;
  }
  if (input.eventType === "liquidity_threshold" || input.eventType === "market_cap_threshold") {
    return `Market change on the exact ${name} contract — not a GitHub code update.`;
  }
  if (input.eventType === "repo_private" || input.eventType === "dormant") {
    return `Public code for ${name} got quieter/harder to see. That does not change the token by itself.`;
  }
  if (CONTRACT_LIKE.has(classKey)) {
    return `Looks like ${evidenceKind}. Closest public clue this might touch ${name} on-chain — not verified as a live contract upgrade.`;
  }
  if (
    classKey.includes("feature") ||
    classKey.includes("sdk") ||
    classKey.includes("api") ||
    classKey.includes("integration") ||
    input.eventType === "release" ||
    input.eventType === "product_launch"
  ) {
    return `Product/shipping work behind ${name}, not an obvious token-contract edit.`;
  }
  return `Link between this update and ${name} is unknown / not verified.`;
}

export function classifyBuildEvidence(input: BuildEvidenceInput): BuildEvidenceLabel {
  const verifiedRelease =
    input.verifiedEvent &&
    (input.eventType === "release" || input.eventType === "product_launch");

  if (
    verifiedRelease ||
    ((input.meaningfulScore ?? 0) >= 7 && input.meaningfulCommits30d >= 2)
  ) {
    return "strong";
  }
  if (
    ((input.meaningfulScore ?? 0) >= 5 && (input.meaningfulScore ?? 0) <= 6) ||
    input.meaningfulCommits30d >= 2
  ) {
    return "moderate";
  }
  if (input.meaningfulCommits30d === 1) return "early";
  return "insufficient";
}

export function classifyIdentity(input: IdentityInput): IdentityLabel {
  if (
    (input.identityConfidence ?? 0) >= 8 &&
    input.hasExactContract &&
    Boolean(input.tokenSourceUrl) &&
    input.contractVerified
  ) {
    return "verified";
  }
  if (
    (input.identityConfidence ?? 0) >= 4 &&
    (input.hasPublicRepository || Boolean(input.tokenSourceUrl))
  ) {
    return "supported";
  }
  return "unverified";
}

export function classifyMarketContext(input: MarketContextInput): MarketContextLabel {
  if (!input.snapshotAt) return "unavailable";
  const snapshotAt =
    input.snapshotAt instanceof Date ? input.snapshotAt : new Date(input.snapshotAt);
  if (Number.isNaN(snapshotAt.getTime())) return "unavailable";

  const ageMs = (input.now ?? new Date()).getTime() - snapshotAt.getTime();
  if (ageMs > 24 * 60 * 60 * 1000) return "stale";
  if (input.liquidityUsd != null && input.liquidityUsd < 5_000) return "thin";
  if (input.liquidityUsd != null && input.liquidityUsd >= 5_000) return "researchable";
  return "unavailable";
}

export function buildSignalCopy(input: BuildSignalCopyInput): BuildSignalCopy {
  const date = formatDate(input.happenedAt);
  const evidenceKind = normalizeClassification(input.classification);
  const name = tokenName(input);
  const market = marketSnippet(input);
  const classKey = classificationKey(input.classification);

  let whatHappened: string;
  if (input.eventType === "meaningful_commit") {
    const count =
      input.commitCount && input.commitCount > 1 ? `${input.commitCount} public commits` : "Public commit";
    whatHappened = `${count} on ${date}: ${evidenceKind}${
      input.meaningfulScore != null ? ` (${input.meaningfulScore}/10)` : ""
    }.`;
  } else if (input.eventType === "repo_private") {
    whatHappened = `Public GitHub repo went private/missing on ${date}.`;
  } else if (input.eventType === "dormant") {
    whatHappened = `Long quiet stretch in public builds noted on ${date}.`;
  } else {
    whatHappened = `${EVENT_PLAIN[input.eventType] ?? "Public update"} on ${date}.`;
  }

  const whyItMayMatter =
    input.eventType === "repo_private" || input.eventType === "dormant"
      ? `Harder to verify what the team behind ${name} is shipping.`
      : input.eventType === "liquidity_threshold" || input.eventType === "market_cap_threshold"
        ? `Pool/market conditions around ${name} changed.`
        : `Team behind ${name} still showing public shipping activity.`;

  const whatWeDoNotKnow = CONTRACT_LIKE.has(classKey)
    ? `Not verified that the live ${name} contract changed.`
    : `Doesn’t prove ${name} usage, revenue, or a contract change.`;

  const whatToWatchNext = CONTRACT_LIKE.has(classKey)
    ? `Next: contract source update or commit naming the live ${name} address.`
    : `Next: release/product note, or another clear public commit.`;

  const tokenRelation = [tokenRelationCopy(input), market].filter(Boolean).join(" ");

  return {
    whatHappened,
    whyItMayMatter,
    tokenRelation,
    whatWeDoNotKnow,
    whatToWatchNext,
  };
}

export function isBuildSignalCopy(value: unknown): value is BuildSignalCopy {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.whatHappened === "string" &&
    row.whatHappened.trim().length > 0 &&
    typeof row.whyItMayMatter === "string" &&
    row.whyItMayMatter.trim().length > 0 &&
    typeof row.tokenRelation === "string" &&
    row.tokenRelation.trim().length > 0 &&
    typeof row.whatWeDoNotKnow === "string" &&
    row.whatWeDoNotKnow.trim().length > 0 &&
    typeof row.whatToWatchNext === "string" &&
    row.whatToWatchNext.trim().length > 0
  );
}

export function explanationFingerprint(input: BuildSignalCopyInput): string {
  const payload = [
    input.projectName,
    input.eventType,
    input.eventTitle ?? "",
    input.eventDescription ?? "",
    input.classification ?? "",
    String(input.meaningfulScore ?? ""),
    String(input.commitCount ?? ""),
    formatDate(input.happenedAt),
    input.shortDescription ?? "",
    input.trackingReason ?? "",
    String(input.identityConfidence ?? ""),
    input.identityLabel,
    input.tokenSymbol ?? "",
    input.tokenChain ?? "",
    input.tokenContract ?? "",
    input.tokenSourceUrl ?? "",
    String(input.contractVerified),
    input.marketLabel,
    String(input.marketCap ?? ""),
    String(input.liquidityUsd ?? ""),
    input.marketSource ?? "",
    formatDate(input.marketSnapshotAt),
  ].join("|");
  // Lightweight stable digest without importing crypto into client bundles.
  let hash = 0;
  for (let i = 0; i < payload.length; i += 1) {
    hash = (hash * 31 + payload.charCodeAt(i)) >>> 0;
  }
  return `v2-${hash.toString(16)}`;
}

export function readCachedAiExplanation(
  metadata: Record<string, unknown> | null | undefined,
  expectedFingerprint: string,
): CachedAiExplanation | null {
  const raw = metadata?.aiExplanation;
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (row.source !== "gemini") return null;
  if (typeof row.fingerprint !== "string" || row.fingerprint !== expectedFingerprint) return null;
  if (typeof row.generatedAt !== "string") return null;
  if (!isBuildSignalCopy(row.copy)) return null;
  return {
    fingerprint: row.fingerprint,
    model: typeof row.model === "string" ? row.model : null,
    generatedAt: row.generatedAt,
    source: "gemini",
    copy: row.copy,
  };
}
