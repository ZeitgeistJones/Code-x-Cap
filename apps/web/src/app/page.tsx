import Link from "next/link";
import { Suspense } from "react";
import {
  CHAINS,
  PRIMARY_CATEGORIES,
  PROJECT_STATUSES,
  TOKEN_STATUSES,
  formatUsdCompact,
} from "@codexcap/core";
import { getRecentBuildSignals, listAllTags, listProjects } from "@/lib/queries";
import { RecencyPill, StatusPill } from "@/components/Badges";
import { BuildSignalCard } from "@/components/BuildSignalCard";
import { BuildCodeCell } from "@/components/BuildCodeCell";
import { DailyUpkeepButton } from "@/components/DailyUpkeepButton";
import { FilterBar } from "@/components/FilterBar";
import { RefreshGithubButton } from "@/components/RefreshGithubButton";
import { RefreshMarketsButton } from "@/components/RefreshMarketsButton";
import { SeedResearchButton } from "@/components/SeedResearchButton";
import { WhyWriteupButton } from "@/components/WhyWriteup";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const filters = {
    q: sp.q,
    status: sp.status,
    category: sp.category,
    chain: sp.chain,
    tokenStatus: sp.tokenStatus,
    tag: sp.tag,
    identityMin: sp.identityMin ? Number(sp.identityMin) : undefined,
    preToken: sp.preToken === "1",
    migration: sp.migration === "1",
    watchlist: sp.watchlist === "1",
    codeRecency: sp.codeRecency,
  };

  let projects: Awaited<ReturnType<typeof listProjects>> = [];
  let tags: Awaited<ReturnType<typeof listAllTags>> = [];
  let buildSignals: Awaited<ReturnType<typeof getRecentBuildSignals>> = [];
  let dbError: string | null = null;

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 30);
  const [projectsResult, tagsResult, signalsResult] = await Promise.allSettled([
    listProjects(filters),
    listAllTags(),
    getRecentBuildSignals({ since, limit: 8 }),
  ]);
  if (projectsResult.status === "fulfilled") projects = projectsResult.value;
  else {
    dbError =
      projectsResult.reason instanceof Error ? projectsResult.reason.message : "Database error";
  }
  if (tagsResult.status === "fulfilled") tags = tagsResult.value;
  else if (!dbError) {
    dbError = tagsResult.reason instanceof Error ? tagsResult.reason.message : "Database error";
  }
  if (signalsResult.status === "fulfilled") buildSignals = signalsResult.value;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">CODE × CAP</p>
          <h1 className="font-display text-2xl text-ink-100">Build Signals</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-400">
            Verified GitHub activity and token market context—explained in plain English.
            <br />
            We show public evidence, source links, and uncertainty. This is research, not a trade
            call.
            {projects.length > 0 ? (
              <span className="ml-1 text-ink-500">· {projects.length} loaded</span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SeedResearchButton />
          <RefreshGithubButton />
          <RefreshMarketsButton />
          <DailyUpkeepButton />
          <Link href="/projects/new" className="btn btn-primary">
            Add project
          </Link>
        </div>
      </div>

      <section className="panel border-accent/20 p-4 text-sm leading-relaxed text-ink-300">
        <h2 className="font-display text-lg text-ink-100">How to read this (no jargon)</h2>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5">
          <li>
            <span className="text-ink-100">Build Signals</span> below are short plain-English notes
            about public GitHub / market evidence. Each one answers: what happened, why it may
            matter, what we do not know, and what to watch next.
          </li>
          <li>
            In the projects table, use{" "}
            <span className="text-accent">Plain English →</span> for a readable research note.
            Numbers (mcap, liquidity, identity score) are context only — not a trade call.
          </li>
          <li>
            Every claim should have a source link, or say{" "}
            <span className="text-ink-100">unknown / not verified</span>. Quiet GitHub can still mean
            private work.
          </li>
        </ol>
      </section>

      {dbError ? (
        <div className="panel border-danger/40 p-4 text-sm text-danger">
          <p className="font-mono text-xs uppercase tracking-wider">Database</p>
          <p className="mt-1">{dbError}</p>
          <p className="mt-2 text-ink-400">
            If you see a missing-column error, wait for the latest deploy, refresh this page (schema
            auto-patches), then click <span className="text-ink-200">Load research seed</span>.
            Confirm <span className="font-mono text-ink-300">DATABASE_URL</span> is set in Vercel
            (plain name, not nested).
          </p>
          <div className="mt-3">
            <SeedResearchButton label="Load research seed now" className="btn btn-primary" />
          </div>
        </div>
      ) : null}

      {projects.length > 0 && projects.length < 17 ? (
        <div className="panel border-warn/40 p-3 text-sm text-ink-300">
          Only <span className="text-ink-100">{projects.length}</span> projects loaded — full pack is
          17. Click <span className="text-accent">Load research seed</span> again to add Mythos,
          Hivra, Delu, HEIR, APINow, StarkBot, and the rest.
        </div>
      ) : null}

      <section className="space-y-3">
        <div>
          <h2 className="font-display text-xl text-ink-100">Recent Build Signals</h2>
          <p className="mt-1 max-w-3xl text-sm text-ink-400">
            Each card names the tracked token, says whether the public code looks token-related or
            only product-related, and shows exact-contract market context. Same project record does
            not automatically mean the live token contract changed.
          </p>
        </div>
        {buildSignals.length > 0 ? (
          <div className="space-y-3">
            {buildSignals.map((signal) => (
              <BuildSignalCard key={signal.id} signal={signal} />
            ))}
          </div>
        ) : (
          <div className="panel p-4 text-sm leading-relaxed text-ink-400">
            <p className="text-ink-200">No plain-English Build Signals ready yet for the last 30 days.</p>
            <p className="mt-2">
              Click <span className="text-accent">Run daily upkeep</span> to refresh public GitHub and
              exact-contract market data. When sourced events arrive, they show up here with
              explanations anyone can read.
            </p>
          </div>
        )}
      </section>

      <Suspense fallback={<div className="panel p-3 text-xs text-ink-500">Loading filters…</div>}>
        <FilterBar
          tags={tags}
          chains={[...CHAINS]}
          statuses={[...PROJECT_STATUSES]}
          categories={[...PRIMARY_CATEGORIES]}
          tokenStatuses={[...TOKEN_STATUSES]}
        />
      </Suspense>

      <div className="panel overflow-x-auto">
        <table className="table-dense min-w-[1280px]">
          <thead>
            <tr>
              <th>Project</th>
              <th>Discovery</th>
              <th>Category</th>
              <th>Status</th>
              <th>Token</th>
              <th>Mcap</th>
              <th>Liquidity</th>
              <th>Vol 24h</th>
              <th>Chain</th>
              <th>Identity</th>
              <th>Build</th>
              <th>Product</th>
              <th>Plain English</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {projects.length === 0 ? (
              <tr>
                <td colSpan={14} className="py-10 text-center text-ink-500">
                  <p>
                    No projects yet.{" "}
                    <Link href="/projects/new" className="text-accent">
                      Add one
                    </Link>{" "}
                    or load the research pack.
                  </p>
                  <div className="mt-3">
                    <SeedResearchButton label="Load research seed" className="btn btn-primary" />
                  </div>
                </td>
              </tr>
            ) : (
              projects.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/projects/${p.slug}`} className="font-medium text-ink-100 hover:text-accent">
                      {p.name}
                    </Link>
                    {p.shortDescription ? (
                      <div className="mt-0.5 max-w-[220px] truncate text-xs text-ink-500">
                        {p.shortDescription}
                      </div>
                    ) : null}
                  </td>
                  <td className="font-mono text-[10px] uppercase text-ink-400">
                    {(p.discoveryTier ?? "—").replace(/_/g, " ")}
                  </td>
                  <td className="font-mono text-xs text-ink-400">
                    {(p.primaryCategory ?? "—").replace(/_/g, " ")}
                  </td>
                  <td>
                    <StatusPill status={p.projectStatus} />
                  </td>
                  <td className="font-mono text-xs">
                    {p.currentToken ? (
                      <>
                        <span className="text-ink-200">{p.currentToken.symbol ?? "—"}</span>
                        <div className="text-ink-500">{p.currentToken.tokenStatus.replace(/_/g, " ")}</div>
                      </>
                    ) : (
                      <span className="text-ink-600">pre-token</span>
                    )}
                  </td>
                  <td className="font-mono text-xs text-ink-200">
                    {formatUsdCompact(p.market?.marketCap ?? p.market?.fdv)}
                  </td>
                  <td className="font-mono text-xs text-ink-300">
                    {formatUsdCompact(p.market?.liquidityUsd)}
                  </td>
                  <td className="font-mono text-xs text-ink-400">
                    {formatUsdCompact(p.market?.volume24h)}
                  </td>
                  <td className="font-mono text-xs text-ink-400">{p.primaryChain ?? "—"}</td>
                  <td className="font-mono text-xs">{p.identityConfidence ?? 0}/10</td>
                  <td>
                    <BuildCodeCell
                      buildVisibility={p.buildVisibility}
                      repos={p.repositories.map((r) => ({
                        owner: r.owner,
                        repo: r.repo,
                        url: r.url,
                        repoRole: r.repoRole,
                        identityVerified: r.identityVerified,
                        latestCommitAt: r.latestCommitAt,
                        latestMeaningfulCommitAt: r.latestMeaningfulCommitAt,
                      }))}
                      meaningful7={p.codeMetrics?.meaningful7 ?? null}
                      meaningful30={p.codeMetrics?.meaningful30 ?? null}
                      daysSinceMeaningful={p.codeMetrics?.daysSinceMeaningful ?? null}
                      latestMeaningfulAt={p.lastMeaningfulBuild}
                      latestCommitAt={p.primaryRepo?.latestCommitAt ?? null}
                      codeMetrics={p.codeMetrics}
                    />
                  </td>
                  <td>
                    <RecencyPill badge={p.productRecency} />
                  </td>
                  <td>
                    <WhyWriteupButton
                      data={{
                        name: p.name,
                        slug: p.slug,
                        discoveryTier: p.discoveryTier,
                        projectStatus: p.projectStatus,
                        buildVisibility: p.buildVisibility,
                        researchPriority: p.researchPriority,
                        shortDescription: p.shortDescription,
                        writeup: p.writeup,
                        whatsHoldingBack: p.whatsHoldingBack,
                        whatToWatch: p.whatToWatch,
                        researchQuestion: p.researchQuestion,
                        whatWouldChangeThesis: p.whatWouldChangeThesis,
                        trackingReason: p.trackingReason,
                        researchContext: p.researchContext,
                        adoptionConfidence: p.adoptionConfidence,
                        activityOrigin: p.activityOrigin,
                        tokenSymbol: p.currentToken?.symbol ?? null,
                      }}
                    />
                  </td>
                  <td>
                    <Link href={`/projects/${p.slug}`} className="font-mono text-[10px] uppercase text-accent">
                      Open
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
