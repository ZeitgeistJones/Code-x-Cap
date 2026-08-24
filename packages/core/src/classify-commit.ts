/**
 * Deterministic first-pass meaningful-commit classifier.
 * No LLM. Humans can override stored rows later.
 */

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

export type CommitClassifyInput = {
  title?: string | null;
  author?: string | null;
  changedPaths?: string[] | null;
  additions?: number | null;
  deletions?: number | null;
};

export type CommitClassifyResult = {
  classification: CommitClassification;
  meaningfulScore: number; // 0–10
  isMeaningful: boolean;
  reason: string;
};

const BOT_AUTHOR =
  /\[bot\]|dependabot|renovate|github-actions|greenkeeper|imgbot|codecov|snyk-bot/i;

const LOCKFILE =
  /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|Cargo\.lock|poetry\.lock|Gemfile\.lock|composer\.lock)$/i;

const README_ONLY = /(^|\/)README(\.[a-z]+)?$/i;
const DOCS = /(^|\/)(docs?|documentation)\//i;
const DOC_EXT = /\.(md|mdx|rst|adoc|txt)$/i;

const SOURCE =
  /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|swift|sol|vy|cairo|move|ex|exs|rb|php|cs|cpp|c|h|hpp)$/i;
const CONTRACT = /\.(sol|vy|cairo|move)$|\/contracts?\//i;
const TEST_PATH = /(^|\/)(test|tests|__tests__|spec|e2e)(\/|$)/i;
const TEST_FILE = /\.(test|spec)\.[jt]sx?$/i;
const SDK_API = /(^|\/)(sdk|api|client|packages\/|src\/api)\//i;
const MIGRATION = /(^|\/)(migrations?|drizzle|prisma\/migrations)\//i;
const DEPLOY = /(^|\/)(\.github\/workflows|Dockerfile|docker-compose|infra|deploy|helm|k8s|terraform)\//i;
const FORMAT_MSG = /^(style|format|lint|prettier|eslint|chore:\s*format|whitespace)/i;
const DEP_MSG =
  /^(chore|build)?(\(.*\))?:\s*(deps?|bump|upgrade|update).*(dependenc|version|lock)|^(bump |upgrade )/i;
const FEATURE_MSG = /^(feat|feature)(\(.*\))?:/i;
const FIX_MSG = /^(fix|bugfix)(\(.*\))?:/i;
const DOCS_MSG = /^(docs?)(\(.*\))?:/i;

function pathIsTest(p: string): boolean {
  return TEST_PATH.test(p) || TEST_FILE.test(p);
}

function pathIsGenerated(p: string): boolean {
  return (
    /(^|\/)(dist|build|\.next|coverage|generated|__generated__|vendor)(\/|$)/i.test(p) ||
    /\.(min|bundle)\.(js|css)$/i.test(p)
  );
}

export function classifyCommit(input: CommitClassifyInput): CommitClassifyResult {
  const title = (input.title ?? "").trim();
  const author = (input.author ?? "").trim();
  const paths = (input.changedPaths ?? []).filter(Boolean);
  const additions = input.additions ?? 0;
  const deletions = input.deletions ?? 0;
  const churn = additions + deletions;

  if (BOT_AUTHOR.test(author) || BOT_AUTHOR.test(title)) {
    return {
      classification: "dependency_update",
      meaningfulScore: 1,
      isMeaningful: false,
      reason: "Automated bot commit",
    };
  }

  if (paths.length === 0) {
    // message-only heuristics
    if (DEP_MSG.test(title) || /dependabot/i.test(title)) {
      return {
        classification: "dependency_update",
        meaningfulScore: 1,
        isMeaningful: false,
        reason: "Dependency/bump message with no file list",
      };
    }
    if (FORMAT_MSG.test(title)) {
      return {
        classification: "formatting",
        meaningfulScore: 1,
        isMeaningful: false,
        reason: "Formatting message with no file list",
      };
    }
    if (DOCS_MSG.test(title)) {
      return {
        classification: "documentation",
        meaningfulScore: 2,
        isMeaningful: false,
        reason: "Docs-only message with no file list",
      };
    }
    if (FEATURE_MSG.test(title)) {
      return {
        classification: "substantive_feature",
        meaningfulScore: 6,
        isMeaningful: true,
        reason: "Feature commit message (files unknown)",
      };
    }
    if (FIX_MSG.test(title)) {
      return {
        classification: "substantive_fix",
        meaningfulScore: 5,
        isMeaningful: true,
        reason: "Fix commit message (files unknown)",
      };
    }
    return {
      classification: "unknown",
      meaningfulScore: 3,
      isMeaningful: false,
      reason: "No changed paths available",
    };
  }

  const allLock = paths.every((p) => LOCKFILE.test(p));
  if (allLock) {
    return {
      classification: "dependency_update",
      meaningfulScore: 1,
      isMeaningful: false,
      reason: "Lockfile-only changes",
    };
  }

  const allReadme = paths.every((p) => README_ONLY.test(p));
  if (allReadme) {
    return {
      classification: "README_only",
      meaningfulScore: 1,
      isMeaningful: false,
      reason: "README-only changes",
    };
  }

  const allDocs = paths.every(
    (p) => DOC_EXT.test(p) || DOCS.test(p) || README_ONLY.test(p),
  );
  if (allDocs) {
    return {
      classification: "documentation",
      meaningfulScore: 2,
      isMeaningful: false,
      reason: "Documentation-only changes",
    };
  }

  const allGenerated = paths.every((p) => pathIsGenerated(p) || LOCKFILE.test(p));
  if (allGenerated) {
    return {
      classification: "generated",
      meaningfulScore: 1,
      isMeaningful: false,
      reason: "Generated/build artifact changes only",
    };
  }

  if (FORMAT_MSG.test(title) && churn < 80 && paths.every((p) => SOURCE.test(p) || DOC_EXT.test(p))) {
    return {
      classification: "formatting",
      meaningfulScore: 2,
      isMeaningful: false,
      reason: "Formatting-oriented commit with low churn",
    };
  }

  // Mass rename / whitespace-ish: many files, tiny net change
  if (paths.length >= 25 && Math.abs(additions - deletions) < 20 && churn < 120) {
    return {
      classification: "formatting",
      meaningfulScore: 2,
      isMeaningful: false,
      reason: "Likely mass rename / low-substance churn across many files",
    };
  }

  const hasContract = paths.some((p) => CONTRACT.test(p));
  const hasSource = paths.some((p) => SOURCE.test(p) && !pathIsGenerated(p));
  const hasTest = paths.some((p) => pathIsTest(p));
  const hasSdk = paths.some((p) => SDK_API.test(p));
  const hasMigration = paths.some((p) => MIGRATION.test(p));
  const hasDeploy = paths.some((p) => DEPLOY.test(p));
  const meaningfulFiles = paths.filter(
    (p) =>
      (SOURCE.test(p) || CONTRACT.test(p) || pathIsTest(p) || MIGRATION.test(p) || DEPLOY.test(p)) &&
      !LOCKFILE.test(p) &&
      !pathIsGenerated(p) &&
      !README_ONLY.test(p),
  ).length;

  let score = 3;
  const reasons: string[] = [];

  if (hasContract) {
    score += 3;
    reasons.push("contract code");
  }
  if (hasSource) {
    score += 2;
    reasons.push("source files");
  }
  if (hasTest) {
    score += 1;
    reasons.push("tests");
  }
  if (hasSdk) {
    score += 1;
    reasons.push("SDK/API paths");
  }
  if (hasMigration) {
    score += 2;
    reasons.push("migrations");
  }
  if (hasDeploy) {
    score += 1;
    reasons.push("deployment/infra");
  }
  if (meaningfulFiles >= 3) {
    score += 1;
    reasons.push("multiple meaningful files");
  }
  if (churn >= 40 && hasSource) {
    score += 1;
    reasons.push("substantive churn");
  }
  if (FEATURE_MSG.test(title)) {
    score += 1;
    reasons.push("feat message");
  }
  if (FIX_MSG.test(title) && hasSource) {
    score += 1;
    reasons.push("fix + source");
  }

  // Penalties
  const lockShare = paths.filter((p) => LOCKFILE.test(p)).length / paths.length;
  if (lockShare > 0.6) {
    score -= 2;
    reasons.push("mostly lockfiles");
  }
  if (DEP_MSG.test(title) && !hasSource && !hasContract) {
    score -= 2;
    reasons.push("dependency bump message");
  }

  score = Math.max(0, Math.min(10, score));

  let classification: CommitClassification = "unknown";
  if (hasContract) classification = "contract_work";
  else if (hasSdk && hasSource) classification = "SDK_API";
  else if (hasDeploy && !hasSource) classification = "deployment";
  else if (hasMigration) classification = "substantive_feature";
  else if (hasTest && !hasSource) classification = "test_infrastructure";
  else if (FEATURE_MSG.test(title) || (hasSource && score >= 6)) classification = "substantive_feature";
  else if (FIX_MSG.test(title) || (hasSource && score >= 5)) classification = "substantive_fix";
  else if (hasSource) classification = "substantive_feature";
  else if (DEP_MSG.test(title)) classification = "dependency_update";

  const isMeaningful = score >= 5 && (hasSource || hasContract || hasMigration || hasDeploy);

  return {
    classification,
    meaningfulScore: score,
    isMeaningful,
    reason: reasons.length ? reasons.join("; ") : "Heuristic score from paths/message",
  };
}

/** Count meaningful commits in a window. */
export function countMeaningfulSince(
  commits: Array<{ timestamp: Date | string; meaningfulScore: number | null }>,
  since: Date,
): number {
  return commits.filter((c) => {
    const t = typeof c.timestamp === "string" ? new Date(c.timestamp) : c.timestamp;
    return t >= since && (c.meaningfulScore ?? 0) >= 5;
  }).length;
}
