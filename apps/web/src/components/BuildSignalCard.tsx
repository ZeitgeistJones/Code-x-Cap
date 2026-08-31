import Link from "next/link";
import { isGenericCaveat } from "@/lib/buildSignals";
import type { getRecentBuildSignals } from "@/lib/queries";

type BuildSignal = Awaited<ReturnType<typeof getRecentBuildSignals>>[number];

function shortAddress(value: string): string {
  if (value.length <= 14) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function formatUsd(value: string | number | null | undefined): string | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

export function BuildSignalCard({ signal }: { signal: BuildSignal }) {
  const snapshot = signal.marketSnapshot;
  const token = signal.currentToken;
  const tokenLabel = token?.symbol ? `$${token.symbol}` : null;
  const when = signal.event.timestamp.toISOString().slice(0, 10);
  const marketBits = [
    formatUsd(snapshot?.marketCap),
    formatUsd(snapshot?.liquidityUsd) ? `${formatUsd(snapshot?.liquidityUsd)} liq` : null,
  ].filter(Boolean);

  return (
    <article className="panel px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <Link
            href={`/projects/${signal.project.slug}`}
            className="font-display text-base text-ink-100 hover:text-accent"
          >
            {signal.project.name}
          </Link>
          {tokenLabel ? <span className="text-sm text-ink-300">{tokenLabel}</span> : null}
          <span className="text-xs text-ink-500">{when}</span>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[10px] uppercase tracking-wide text-ink-500">
          <span className="border border-ink-700 px-1.5 py-0.5">{signal.labels.buildEvidence}</span>
          <span className="border border-ink-700 px-1.5 py-0.5">{signal.labels.identity}</span>
          <span className="border border-ink-700 px-1.5 py-0.5">{signal.labels.market}</span>
        </div>
      </div>

      <p className="mt-2 text-sm leading-snug text-ink-100">{signal.copy.whatHappened}</p>
      <p className="mt-1 text-sm leading-snug text-ink-400">
        {signal.copy.tokenRelation}
        {signal.copy.whyItMayMatter ? ` ${signal.copy.whyItMayMatter}` : ""}
      </p>
      {isGenericCaveat(signal.copy) ? null : (
        <p className="mt-1 text-xs text-ink-500">
          {signal.copy.whatWeDoNotKnow} {signal.copy.whatToWatchNext}
        </p>
      )}
      {marketBits.length > 0 || token?.contractAddress ? (
        <p className="mt-1 text-xs text-ink-500">
          {[...marketBits, token?.contractAddress ? shortAddress(token.contractAddress) : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-3 text-xs">
        {signal.event.sourceUrl ? (
          <a
            href={signal.event.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-accent hover:underline"
          >
            Source ↗
          </a>
        ) : null}
        {snapshot?.sourceUrl ? (
          <a
            href={snapshot.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-ink-400 hover:text-accent"
          >
            Market ↗
          </a>
        ) : null}
        <Link href={`/projects/${signal.project.slug}`} className="text-ink-400 hover:text-accent">
          Project →
        </Link>
      </div>
    </article>
  );
}
