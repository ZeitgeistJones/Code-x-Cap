import { RecencyBadge, RECENCY_LABELS } from "@codexcap/core";

const styles: Record<RecencyBadge, string> = {
  hot: "border-[color:var(--accent)] bg-[var(--accent-muted)] text-[color:var(--accent)]",
  active: "border-[color:var(--cool)] bg-[color:rgba(106,155,184,0.12)] text-[color:var(--cool)]",
  cooling: "border-[color:var(--warn)] bg-[color:rgba(212,162,76,0.12)] text-[color:var(--warn)]",
  dormant: "border-[color:var(--danger)] bg-[color:rgba(196,92,92,0.12)] text-[color:var(--danger)]",
  unknown: "border-ink-600 bg-ink-800 text-ink-400",
};

export function RecencyPill({ badge }: { badge: RecencyBadge }) {
  return (
    <span
      className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${styles[badge]}`}
    >
      {badge === "hot"
        ? "🔥 "
        : badge === "active"
          ? "🟢 "
          : badge === "cooling"
            ? "🟡 "
            : badge === "dormant"
              ? "🔴 "
              : "⚪ "}
      {RECENCY_LABELS[badge]}
    </span>
  );
}

export function StatusPill({ status }: { status: string }) {
  return (
    <span className="inline-flex rounded-sm border border-ink-600 bg-ink-800 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-300">
      {status.replace(/_/g, " ")}
    </span>
  );
}
