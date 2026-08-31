import Link from "next/link";
import {
  BUILD_EVIDENCE_EXPLAIN,
  IDENTITY_EXPLAIN,
  MARKET_CONTEXT_EXPLAIN,
  type BuildEvidenceLabel,
  type IdentityLabel,
  type MarketContextLabel,
} from "@/lib/buildSignals";
import type { getRecentBuildSignals } from "@/lib/queries";

type BuildSignal = Awaited<ReturnType<typeof getRecentBuildSignals>>[number];

function shortAddress(value: string): string {
  if (value.length <= 14) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function LabelChip({
  title,
  value,
  explain,
}: {
  title: string;
  value: string;
  explain: string;
}) {
  return (
    <div className="max-w-[16rem] border border-ink-700 px-2 py-1.5">
      <p className="font-mono text-[9px] uppercase tracking-wider text-ink-500">
        {title}: <span className="text-ink-200">{value}</span>
      </p>
      <p className="mt-0.5 text-xs leading-snug text-ink-400">{explain}</p>
    </div>
  );
}

function Section({
  title,
  body,
  emphasis = false,
}: {
  title: string;
  body: string;
  emphasis?: boolean;
}) {
  return (
    <section className={emphasis ? "border border-accent/25 bg-accent-muted/20 p-3" : undefined}>
      <h3 className={`text-sm font-medium ${emphasis ? "text-accent" : "text-ink-100"}`}>{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-ink-300">{body}</p>
    </section>
  );
}

export function BuildSignalCard({ signal }: { signal: BuildSignal }) {
  const snapshot = signal.marketSnapshot;
  const build = signal.labels.buildEvidence as BuildEvidenceLabel;
  const identity = signal.labels.identity as IdentityLabel;
  const market = signal.labels.market as MarketContextLabel;
  const when = signal.event.timestamp.toISOString().slice(0, 16).replace("T", " ");
  const token = signal.currentToken;
  const tokenLabel = token?.symbol ? `$${token.symbol}` : "token unknown";

  return (
    <article className="panel p-5">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-800 pb-3">
        <div>
          <p className="text-xs text-ink-500">
            Build signal · {tokenLabel}
            {token?.chain ? ` · ${token.chain}` : ""}
            {signal.copySource === "gemini"
              ? " · Gemini rewrite from public evidence"
              : " · template copy (add GEMINI_API_KEY + run upkeep for plain-English rewrite)"}
          </p>
          <Link
            href={`/projects/${signal.project.slug}`}
            className="font-display text-lg text-ink-100 hover:text-accent"
          >
            {signal.project.name}
          </Link>
          <p className="mt-1 text-xs text-ink-500">
            {when} UTC
            {token?.contractAddress
              ? ` · exact contract ${shortAddress(token.contractAddress)}`
              : " · exact token contract unknown / not verified"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <LabelChip title="Build evidence" value={build} explain={BUILD_EVIDENCE_EXPLAIN[build]} />
          <LabelChip title="Identity" value={identity} explain={IDENTITY_EXPLAIN[identity]} />
          <LabelChip title="Market context" value={market} explain={MARKET_CONTEXT_EXPLAIN[market]} />
        </div>
      </header>

      <div className="mt-4 space-y-4">
        <Section
          title={`How this relates to ${tokenLabel}`}
          body={signal.copy.tokenRelation}
          emphasis
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="What happened" body={signal.copy.whatHappened} />
          <Section title="Why it may matter" body={signal.copy.whyItMayMatter} />
          <Section title="What we do not know" body={signal.copy.whatWeDoNotKnow} />
          <Section title="What to watch next" body={signal.copy.whatToWatchNext} />
        </div>
      </div>

      <footer className="mt-4 flex flex-wrap items-center gap-3 border-t border-ink-800 pt-3 text-xs">
        <a
          href={signal.event.sourceUrl ?? ""}
          target="_blank"
          rel="noreferrer"
          className="text-accent hover:underline"
        >
          Read the public source ↗
        </a>
        {token?.sourceUrl ? (
          <a
            href={token.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-ink-400 hover:text-accent"
          >
            Token / contract source ↗
          </a>
        ) : (
          <span className="text-ink-600">Token source unknown / not verified</span>
        )}
        {snapshot?.sourceUrl ? (
          <a
            href={snapshot.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-ink-400 hover:text-accent"
          >
            Exact-contract market snapshot ·{" "}
            {snapshot.timestamp.toISOString().slice(0, 16).replace("T", " ")} UTC ↗
          </a>
        ) : (
          <span className="text-ink-600">Market source unknown / not verified</span>
        )}
        <Link href={`/projects/${signal.project.slug}#why`} className="text-ink-400 hover:text-accent">
          Full research note →
        </Link>
      </footer>
    </article>
  );
}
