/**
 * Pure Build Signals classification and copy mapping.
 * No database access: callers provide public evidence already loaded.
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
  classification: string | null;
  meaningfulScore: number | null;
  happenedAt: Date | string;
}

export interface BuildSignalCopy {
  whatHappened: string;
  whyItMayMatter: string;
  whatWeDoNotKnow: string;
  whatToWatchNext: string;
}

const CLASSIFICATION_LANGUAGE: Record<string, string> = {
  feature: "product feature",
  product_feature: "product feature",
  substantive_feature: "product feature",
  bug_fix: "reliability work",
  substantive_fix: "reliability work",
  test: "reliability work",
  testing: "reliability work",
  test_infrastructure: "reliability work",
  integration: "developer integration",
  sdk: "developer integration",
  sdk_api: "developer integration",
  api: "developer integration",
  contract: "onchain contract work",
  contract_work: "onchain contract work",
  smart_contract: "onchain contract work",
  migration: "onchain contract work",
  deployment: "delivery infrastructure",
  devops: "delivery infrastructure",
  infrastructure: "delivery infrastructure",
};

function normalizeClassification(value: string | null): string {
  if (!value) return "build work";
  const key = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return CLASSIFICATION_LANGUAGE[key] ?? "build work";
}

function plainClassification(value: string | null): string {
  if (!value) return "build change";
  return value.trim().toLowerCase().replace(/[_-]+/g, " ");
}

function formatDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "an unknown date";
  return date.toISOString().slice(0, 10);
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
  const score = input.meaningfulScore ?? 0;

  if (input.eventType === "meaningful_commit") {
    return {
      whatHappened:
        `${input.projectName} recorded a public ${plainClassification(input.classification)} ` +
        `on ${date}. The commit received a ${score}/10 first-pass build-evidence score.`,
      whyItMayMatter:
        `This is visible evidence of ${evidenceKind}. It may improve the project’s ability ` +
        "to ship or maintain its product, but public code activity alone does not demonstrate " +
        "users, revenue, security, or token demand.",
      whatWeDoNotKnow:
        "The public record does not tell us whether this change is live, adopted, complete, " +
        "or material to the token’s economics.",
      whatToWatchNext:
        "Look for a release, deployment, follow-up tests, public product documentation, or " +
        "another meaningful commit that confirms this work reached a usable surface.",
    };
  }

  return {
    whatHappened:
      `${input.projectName} recorded a public ${input.eventType.replace(/_/g, " ")} event on ${date}.`,
    whyItMayMatter:
      "This is visible public evidence about the project’s build or operating state. It may " +
      "change how confidently the project can be followed, but it does not demonstrate users, " +
      "revenue, security, or token demand.",
    whatWeDoNotKnow:
      "The public record does not tell us whether this event is complete, durable, adopted, " +
      "or material to the token’s economics.",
    whatToWatchNext:
      "Look for a linked release, deployment, follow-up documentation, or another public event " +
      "that confirms the change reached a usable surface.",
  };
}
