"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";

export type WhyWriteupData = {
  name: string;
  slug: string;
  discoveryTier: string | null;
  projectStatus: string;
  buildVisibility?: string | null;
  researchPriority?: string | null;
  shortDescription: string | null;
  writeup: string | null;
  whatsHoldingBack: string | null;
  whatToWatch: string | null;
  researchQuestion?: string | null;
  whatWouldChangeThesis?: string | null;
  trackingReason: string | null;
  researchContext: string | null;
  adoptionConfidence?: number | null;
  activityOrigin?: string | null;
  tokenSymbol?: string | null;
};

function Badge({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "accent" | "warn" }) {
  const cls =
    tone === "accent"
      ? "border-accent/40 bg-accent-muted text-accent"
      : tone === "warn"
        ? "border-[color:var(--warn)]/40 text-[color:var(--warn)]"
        : "border-ink-600 text-ink-400";
  return (
    <span className={`rounded-sm border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${cls}`}>
      {children}
    </span>
  );
}

export function WhyWriteupBody({ data }: { data: WhyWriteupData }) {
  const tier = (data.discoveryTier ?? "under_the_radar").replace(/_/g, " ");
  const status = data.projectStatus.replace(/_/g, " ");
  const visibility = (data.buildVisibility ?? "unknown").replace(/_/g, " ");
  const priority = (data.researchPriority ?? "medium").replace(/_/g, " ");
  const interesting =
    data.writeup?.trim() || data.trackingReason?.trim() || data.shortDescription?.trim() || null;

  return (
    <div className="space-y-4 text-sm leading-relaxed text-ink-300">
      <div className="flex flex-wrap gap-2">
        <Badge tone="accent">{tier}</Badge>
        <Badge>{status}</Badge>
        <Badge tone="warn">{visibility}</Badge>
        <Badge>{priority}</Badge>
        {data.tokenSymbol ? <Badge>${data.tokenSymbol}</Badge> : <Badge>no token</Badge>}
      </div>

      <div>
        <h3 className="font-mono text-[10px] uppercase tracking-widest text-accent">
          Why it&apos;s interesting
        </h3>
        <p className="mt-1.5 whitespace-pre-wrap text-ink-200">
          {interesting || "No write-up recorded yet."}
        </p>
      </div>

      <div>
        <h3 className="font-mono text-[10px] uppercase tracking-widest text-warn">
          What&apos;s holding it back
        </h3>
        <p className="mt-1.5 whitespace-pre-wrap text-ink-200">
          {data.whatsHoldingBack?.trim() || "Not recorded yet."}
        </p>
      </div>

      <div>
        <h3 className="font-mono text-[10px] uppercase tracking-widest text-ink-100">
          Biggest unanswered question
        </h3>
        <p className="mt-1.5 whitespace-pre-wrap text-ink-100">
          {data.researchQuestion?.trim() || "Not recorded yet."}
        </p>
      </div>

      <div>
        <h3 className="font-mono text-[10px] uppercase tracking-widest text-ink-500">
          What would change the thesis
        </h3>
        <p className="mt-1.5 whitespace-pre-wrap text-ink-300">
          {data.whatWouldChangeThesis?.trim() || "Not recorded yet."}
        </p>
      </div>

      <div>
        <h3 className="font-mono text-[10px] uppercase tracking-widest text-ink-500">What to watch</h3>
        <p className="mt-1.5 whitespace-pre-wrap text-ink-300">
          {data.whatToWatch?.trim() || "Not recorded yet."}
        </p>
      </div>

      <p className="font-mono text-[10px] text-ink-600">
        Build visibility ≠ status. Stale public commits ≠ dormant if development is private. Adoption
        confidence: {data.adoptionConfidence ?? 0}/10 · activity origin:{" "}
        {(data.activityOrigin ?? "unknown").replace(/_/g, " ")}.
      </p>
    </div>
  );
}

export function WhyWriteupButton({ data }: { data: WhyWriteupData }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="font-mono text-[10px] uppercase tracking-wider text-accent hover:underline"
        onClick={() => setOpen(true)}
      >
        Why
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={() => setOpen(false)}
        >
          <div
            className="panel max-h-[85vh] w-full max-w-lg overflow-y-auto border-ink-600 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 id={titleId} className="font-display text-2xl text-ink-100">
                  {data.name}
                </h2>
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-500">
                  Living research note
                </p>
              </div>
              <button type="button" className="btn" onClick={() => setOpen(false)} aria-label="Close">
                Close
              </button>
            </div>

            <WhyWriteupBody data={data} />

            <div className="mt-6 flex gap-2 border-t border-ink-800 pt-4">
              <Link href={`/projects/${data.slug}#why`} className="btn btn-primary" onClick={() => setOpen(false)}>
                Full project page
              </Link>
              <button type="button" className="btn" onClick={() => setOpen(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
