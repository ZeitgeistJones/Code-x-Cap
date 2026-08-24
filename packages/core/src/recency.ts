/** Recency helpers — kept separate so build-display can import without cycles. */

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
