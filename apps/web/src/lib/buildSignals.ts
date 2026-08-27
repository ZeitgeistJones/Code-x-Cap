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

function shortAddress(value: string): string {
  if (value.length <= 14) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function formatUsd(value: number | null): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${Math.round(value).toLocaleString()}`;
}

function firstSentence(value: string | null, max = 160): string | null {
  if (!value?.trim()) return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  const cut = cleaned.match(/^.{1,160}?[.!?](?:\s|$)/)?.[0]?.trim() ?? cleaned.slice(0, max);
  return cut.length < cleaned.length && cut === cleaned.slice(0, max) ? `${cut}…` : cut;
}

function tokenName(input: BuildSignalCopyInput): string {
  if (input.tokenSymbol?.trim()) return `$${input.tokenSymbol.trim()}`;
  return "this project’s token";
}

function tokenIdentityLine(input: BuildSignalCopyInput): string {
  const name = tokenName(input);
  if (!input.tokenContract?.trim()) {
    return `${name} has no exact contract address on record yet (unknown / not verified).`;
  }
  const chain = input.tokenChain?.trim() || "unknown chain";
  const verified = input.contractVerified ? "marked contract-verified" : "not marked contract-verified";
  const source = input.tokenSourceUrl?.trim()
    ? "with a public source link for the contract"
    : "but the contract source link is missing (unknown / not verified)";
  return (
    `Tracked token: ${name} on ${chain}, exact contract ${shortAddress(input.tokenContract)} ` +
    `(${verified}, ${source}). Identity confidence ${input.identityConfidence ?? 0}/10 ` +
    `(${input.identityLabel}).`
  );
}

function marketLine(input: BuildSignalCopyInput): string {
  if (!input.tokenContract?.trim()) {
    return "No exact-contract market snapshot is available because no contract address is attached.";
  }
  if (input.marketLabel === "unavailable" || (!input.marketCap && !input.liquidityUsd)) {
    return (
      `We do not have a usable recent market snapshot for that exact ${tokenName(input)} contract ` +
      `(unknown / not verified).`
    );
  }
  const parts = [
    formatUsd(input.marketCap) ? `market size about ${formatUsd(input.marketCap)}` : null,
    formatUsd(input.liquidityUsd) ? `pool liquidity about ${formatUsd(input.liquidityUsd)}` : null,
  ].filter(Boolean);
  const when = formatDate(input.marketSnapshotAt);
  const source = input.marketSource?.trim() || "public market feed";
  const quality =
    input.marketLabel === "thin"
      ? "The pool looks thin, so these numbers are easy to misread."
      : input.marketLabel === "stale"
        ? "This snapshot is older than a day, so treat it as stale context only."
        : "These figures are context only — not a price forecast.";
  return (
    `Latest exact-contract market context (${source}, ${when}): ${parts.join("; ") || "limited fields"}. ` +
    quality
  );
}

function tokenRelationCopy(input: BuildSignalCopyInput): string {
  const name = tokenName(input);
  const classKey = classificationKey(input.classification);
  const evidenceKind = normalizeClassification(input.classification);
  const identity = tokenIdentityLine(input);
  const market = marketLine(input);

  if (input.eventType === "token_migration") {
    return (
      `${identity} This event is explicitly about a token migration. ` +
      `That is a direct token-identity event — still verify the destination contract against the source link. ${market}`
    );
  }

  if (input.eventType === "liquidity_threshold" || input.eventType === "market_cap_threshold") {
    return (
      `${identity} This signal comes from market data on the exact tracked contract, ` +
      `not from GitHub. ${market}`
    );
  }

  if (input.eventType === "repo_private" || input.eventType === "dormant") {
    return (
      `${identity} Public build visibility for the product behind ${name} just got weaker or quieter. ` +
      `That does not by itself change the token contract, supply, or pool — it only reduces what outsiders can verify. ${market}`
    );
  }

  if (CONTRACT_LIKE.has(classKey)) {
    return (
      `${identity} The public change looks like ${evidenceKind}, which is the closest public clue ` +
      `that build activity might touch on-chain or token mechanics. ` +
      `We have not verified that this specific commit redeployed or upgraded the live ${name} contract. ${market}`
    );
  }

  if (
    classKey.includes("feature") ||
    classKey.includes("sdk") ||
    classKey.includes("api") ||
    classKey.includes("integration") ||
    input.eventType === "release" ||
    input.eventType === "product_launch"
  ) {
    return (
      `${identity} This looks like product/shipping work (${evidenceKind}), not an obvious token-contract edit. ` +
      `It may matter for the product people associate with ${name}, but public code activity alone does not prove ` +
      `${name} is required, used, or economically linked to this change. ${market}`
    );
  }

  return (
    `${identity} From public evidence alone, the link between this GitHub activity and ${name} is unproven. ` +
    `Same project record ≠ same contract, same users, or same economics. ${market}`
  );
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
  const score = input.meaningfulScore;
  const name = tokenName(input);
  const eventPlain = EVENT_PLAIN[input.eventType] ?? "public event";
  const projectBlurb =
    firstSentence(input.shortDescription) || firstSentence(input.trackingReason);
  const detail =
    firstSentence(input.eventDescription) ||
    firstSentence(input.eventTitle) ||
    null;
  const commitBit =
    input.commitCount && input.commitCount > 1
      ? `${input.commitCount} meaningful public commits grouped for the day`
      : "a meaningful public commit";

  let whatHappened: string;
  if (input.eventType === "meaningful_commit") {
    whatHappened =
      `On ${date}, ${input.projectName} showed ${commitBit} classified as ${evidenceKind}` +
      (score != null ? ` (first-pass score ${score}/10)` : "") +
      `.` +
      (detail ? ` Public note: ${detail}` : "") +
      (projectBlurb ? ` Project context: ${projectBlurb}` : "");
  } else {
    whatHappened =
      `On ${date}, ${input.projectName} had a public ${eventPlain}.` +
      (detail ? ` Public note: ${detail}` : "") +
      (projectBlurb ? ` Project context: ${projectBlurb}` : "");
  }

  const whyItMayMatter =
    input.eventType === "meaningful_commit" ||
    input.eventType === "release" ||
    input.eventType === "product_launch"
      ? `For someone following ${name}, this is evidence the team may still be shipping the product ` +
        `tied to that token ticker — useful for build visibility, not for guessing price. ` +
        `Stronger when identity is solid; weaker when the contract link is unverified.`
      : input.eventType === "liquidity_threshold" || input.eventType === "market_cap_threshold"
        ? `This is market-structure context for the exact ${name} contract, shown beside build evidence ` +
          `so you can see operating conditions — not a recommendation.`
        : `This public signal changes how confidently outsiders can follow the project behind ${name}.`;

  const whatWeDoNotKnow =
    `We do not know whether this change is live, finished, secure, adopted, or economically material to ${name}. ` +
    `We also do not know private roadmap work. ` +
    (input.tokenContract
      ? `Unless a source proves it, assume the GitHub change did not automatically alter the live ${name} contract.`
      : `Without an exact contract on file, any token link stays unknown / not verified.`);

  const whatToWatchNext = CONTRACT_LIKE.has(classificationKey(input.classification))
    ? `Watch for a verified contract source update, explorer verification, migration notice, ` +
      `or another commit that names the live ${name} address. Also watch whether exact-contract liquidity stays readable.`
    : `Watch for a release/product note that mentions ${name} or the exact contract, ` +
      `plus follow-up commits that show this work reached a usable surface. Keep checking the exact-contract market snapshot for freshness only.`;

  return {
    whatHappened,
    whyItMayMatter,
    tokenRelation: tokenRelationCopy(input),
    whatWeDoNotKnow,
    whatToWatchNext,
  };
}
