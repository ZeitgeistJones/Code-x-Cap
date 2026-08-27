import Link from "next/link";
import type { getRecentBuildSignals } from "@/lib/queries";

type BuildSignal = Awaited<ReturnType<typeof getRecentBuildSignals>>[number];

function Label({ name, value }: { name: string; value: string }) {
  return (
    <span className="border border-ink-700 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-ink-300">
      {name}: {value}
    </span>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <section>
      <h3 className="font-mono text-[10px] uppercase tracking-widest text-accent">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-ink-300">{body}</p>
    </section>
  );
}

export function BuildSignalCard({ signal }: { signal: BuildSignal }) {
  const snapshot = signal.marketSnapshot;

  return (
    <article className="panel p-5">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-800 pb-3">
        <div>
          <Link
            href={`/projects/${signal.project.slug}`}
            className="font-display text-lg text-ink-100 hover:text-accent"
          >
            {signal.project.name}
          </Link>
          <p className="mt-1 font-mono text-[10px] text-ink-500">
            {signal.event.timestamp.toISOString().slice(0, 16).replace("T", " ")} UTC
            {signal.currentToken?.contractAddress
              ? ` · ${signal.currentToken.chain} · ${signal.currentToken.contractAddress}`
              : " · token identity unknown / not verified"}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Label name="Build evidence" value={signal.labels.buildEvidence} />
          <Label name="Identity" value={signal.labels.identity} />
          <Label name="Market context" value={signal.labels.market} />
        </div>
      </header>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Section title="WHAT HAPPENED" body={signal.copy.whatHappened} />
        <Section title="WHY IT MAY MATTER" body={signal.copy.whyItMayMatter} />
        <Section title="WHAT WE DO NOT KNOW" body={signal.copy.whatWeDoNotKnow} />
        <Section title="WHAT TO WATCH NEXT" body={signal.copy.whatToWatchNext} />
      </div>

      <footer className="mt-4 flex flex-wrap items-center gap-3 border-t border-ink-800 pt-3 font-mono text-[10px]">
        <a
          href={signal.event.sourceUrl ?? ""}
          target="_blank"
          rel="noreferrer"
          className="text-accent hover:underline"
        >
          Open public source ↗
        </a>
        {snapshot?.sourceUrl ? (
          <a
            href={snapshot.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-ink-400 hover:text-accent"
          >
            Exact-contract snapshot · {snapshot.timestamp.toISOString().slice(0, 16)} UTC ↗
          </a>
        ) : (
          <span className="text-ink-600">Market source unknown / not verified</span>
        )}
      </footer>
    </article>
  );
}
