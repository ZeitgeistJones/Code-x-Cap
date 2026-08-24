/**
 * Build-activity presentation — visibility-aware, never fake dormancy for private/mirror.
 */

import { daysSince, recencyBadge, type RecencyBadge } from "./recency";

export type CodeDisplayMode =
  | "open_recency"
  | "mirror_lag"
  | "integration_public"
  | "private"
  | "no_repo"
  | "unknown";

export type CodeDisplay = {
  mode: CodeDisplayMode;
  openRecency: RecencyBadge | null;
  label: string;
  sublabel: string | null;
  daysSinceMeaningful: number | null;
};

export function codeDisplayForProject(input: {
  buildVisibility?: string | null;
  latestMeaningfulAt?: Date | string | null;
  latestCommitAt?: Date | string | null;
  hasPublicRepo?: boolean;
}): CodeDisplay {
  const visibility = input.buildVisibility ?? "unknown";
  const meaningfulDays = daysSince(input.latestMeaningfulAt);
  const anyDays = daysSince(input.latestCommitAt ?? input.latestMeaningfulAt);
  const openRecency = recencyBadge(input.latestMeaningfulAt ?? input.latestCommitAt);

  if (visibility === "no_verified_repo" || input.hasPublicRepo === false) {
    return {
      mode: "no_repo",
      openRecency: null,
      label: "NO PUBLIC REPO",
      sublabel: "code recency unknown",
      daysSinceMeaningful: null,
    };
  }

  if (visibility === "closed_private") {
    return {
      mode: "private",
      openRecency: null,
      label: "PRIVATE",
      sublabel: "code recency unknown",
      daysSinceMeaningful: null,
    };
  }

  if (visibility === "public_snapshot_private_current") {
    return {
      mode: "mirror_lag",
      openRecency: null,
      label: "◐ MIRROR",
      sublabel: anyDays != null ? `public sync ${anyDays}d ago` : "public sync age unknown",
      daysSinceMeaningful: meaningfulDays,
    };
  }

  if (visibility === "integration_public_core_private") {
    return {
      mode: "integration_public",
      openRecency: null,
      label: "CORE PRIVATE",
      sublabel: anyDays != null ? `public skill ${anyDays}d ago` : "public surface age unknown",
      daysSinceMeaningful: meaningfulDays,
    };
  }

  if (!input.latestMeaningfulAt && !input.latestCommitAt) {
    return {
      mode: "unknown",
      openRecency: "unknown",
      label: "UNKNOWN",
      sublabel: "insufficient GitHub evidence",
      daysSinceMeaningful: null,
    };
  }

  const emoji =
    openRecency === "hot"
      ? "🔥 HOT"
      : openRecency === "active"
        ? "🟢 ACTIVE"
        : openRecency === "cooling"
          ? "🟡 COOLING"
          : openRecency === "dormant"
            ? "🔴 DORMANT"
            : "⚪ UNKNOWN";

  return {
    mode: "open_recency",
    openRecency,
    label: emoji,
    sublabel: meaningfulDays != null ? `${meaningfulDays}d` : null,
    daysSinceMeaningful: meaningfulDays,
  };
}

export function repoRoleLabel(role: string | null | undefined): string {
  if (!role) return "REPO";
  const r = role.toLowerCase();
  if (r === "mirror") return "MIRROR";
  if (r === "skill") return "SKILL";
  if (r === "sdk") return "SDK";
  if (r === "org") return "ORG";
  if (r === "mcp") return "MCP";
  if (r === "cli") return "CLI";
  if (r === "contracts") return "CONTRACTS";
  if (r === "x402") return "X402";
  if (r === "historical") return "HISTORICAL";
  if (r === "core") return "CORE";
  return role.replace(/_/g, " ").toUpperCase();
}

export function pickPrimaryRepo<T extends { repoRole: string }>(repos: T[]): T | null {
  if (!repos.length) return null;
  const rank = (role: string) => {
    const r = role.toLowerCase();
    if (r === "core") return 0;
    if (r === "mirror") return 1;
    if (r === "sdk" || r === "skill") return 2;
    if (r === "mcp" || r === "cli" || r === "x402") return 3;
    if (r === "org") return 4;
    return 5;
  };
  return [...repos].sort((a, b) => rank(a.repoRole) - rank(b.repoRole))[0] ?? null;
}
