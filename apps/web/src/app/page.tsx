import Link from "next/link";
import { Suspense } from "react";
import {
  CHAINS,
  PRIMARY_CATEGORIES,
  PROJECT_STATUSES,
  TOKEN_STATUSES,
  formatUsdCompact,
} from "@codexcap/core";
import { refreshAllMarketsAction } from "@/app/actions/market";
import { refreshAllGithubAction } from "@/app/actions/github";
import { listAllTags, listProjects } from "@/lib/queries";
import { RecencyPill, StatusPill } from "@/components/Badges";
import { FilterBar } from "@/components/FilterBar";
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
  let dbError: string | null = null;

  try {
    [projects, tags] = await Promise.all([listProjects(filters), listAllTags()]);
  } catch (e) {
    dbError = e instanceof Error ? e.message : "Database error";
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-ink-100">Projects</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-400">
            Manual research database. Refresh GitHub for meaningful code; refresh markets for mcap.
            {projects.length > 0 ? (
              <span className="ml-1 text-ink-500">· {projects.length} loaded</span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SeedResearchButton />
          <form action={refreshAllGithubAction}>
            <button type="submit" className="btn">
              Refresh GitHub
            </button>
          </form>
          <form action={refreshAllMarketsAction}>
            <button type="submit" className="btn">
              Refresh markets
            </button>
          </form>
          <Link href="/projects/new" className="btn btn-primary">
            Add project
          </Link>
        </div>
      </div>

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
              <th>Code</th>
              <th>Product</th>
              <th>Last meaningful</th>
              <th>Why</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {projects.length === 0 ? (
              <tr>
                <td colSpan={15} className="py-10 text-center text-ink-500">
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
                    {formatUsdCompact(p.market?.marketCap)}
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
                    <RecencyPill badge={p.codeRecency} />
                  </td>
                  <td>
                    <RecencyPill badge={p.productRecency} />
                  </td>
                  <td className="font-mono text-[11px] text-ink-400">
                    {p.lastMeaningfulBuild
                      ? new Date(p.lastMeaningfulBuild).toISOString().slice(0, 10)
                      : "—"}
                    {p.codeSummary ? (
                      <div className="mt-0.5 max-w-[140px] truncate text-[10px] text-ink-600">
                        {p.codeSummary}
                      </div>
                    ) : null}
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
