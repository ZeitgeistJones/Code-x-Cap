import Link from "next/link";
import { Suspense } from "react";
import {
  CHAINS,
  PRIMARY_CATEGORIES,
  PROJECT_STATUSES,
  TOKEN_STATUSES,
} from "@codexcap/core";
import { listAllTags, listProjects } from "@/lib/queries";
import { RecencyPill, StatusPill } from "@/components/Badges";
import { FilterBar } from "@/components/FilterBar";

export const dynamic = "force-dynamic";

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
            Manual research database. Market and GitHub columns fill as you enter signals — automation
            arrives in later phases.
          </p>
        </div>
        <Link href="/projects/new" className="btn btn-primary">
          Add project
        </Link>
      </div>

      {dbError ? (
        <div className="panel border-danger/40 p-4 text-sm text-danger">
          <p className="font-mono text-xs uppercase tracking-wider">Database</p>
          <p className="mt-1">{dbError}</p>
          <p className="mt-2 text-ink-400">
            Set DATABASE_URL (Neon) and run migrations + seed. See README.
          </p>
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
        <table className="table-dense min-w-[1100px]">
          <thead>
            <tr>
              <th>Project</th>
              <th>Category</th>
              <th>Status</th>
              <th>Token</th>
              <th>Chain</th>
              <th>Identity</th>
              <th>Code</th>
              <th>Product</th>
              <th>Last meaningful</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {projects.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-10 text-center text-ink-500">
                  No projects yet.{" "}
                  <Link href="/projects/new" className="text-accent">
                    Add one
                  </Link>{" "}
                  or run <span className="font-mono text-ink-400">pnpm db:seed</span>.
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
