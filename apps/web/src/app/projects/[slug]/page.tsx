import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ACTIVITY_SIGNAL_TYPES,
  CHAINS,
  EVENT_SEVERITIES,
  EVENT_TYPES,
  RECENCY_LABELS,
  REPO_ROLES,
  SCORE_DIMENSIONS,
  TOKEN_ROLES,
  TOKEN_STATUSES,
  recencyBadge,
} from "@codexcap/core";
import {
  addEventAction,
  addEvidenceAction,
  addNoteAction,
  addRepoAction,
  addTokenAction,
  deleteProjectAction,
  toggleWatchlistAction,
  upsertScoreAction,
  upsertSignalAction,
} from "@/app/actions/projects";
import { RecencyPill, StatusPill } from "@/components/Badges";
import { getProjectBySlug } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = await getProjectBySlug(slug).catch(() => null);
  if (!project) notFound();

  const signalMap = Object.fromEntries(project.signals.map((s) => [s.signalType, s]));
  const scoreMap = Object.fromEntries(project.scores.map((s) => [s.dimension, s]));

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-ink-800 pb-6">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl text-ink-100">{project.name}</h1>
            <StatusPill status={project.projectStatus} />
            <span className="rounded-sm border border-ink-600 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-400">
              {(project.discoveryTier ?? "under_the_radar").replace(/_/g, " ")}
            </span>
            <span className="font-mono text-xs text-ink-500">id {project.identityConfidence ?? 0}/10</span>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-ink-400">{project.shortDescription}</p>
          {project.trackingReason ? (
            <p className="mt-2 max-w-2xl text-xs text-ink-500">
              <span className="font-mono uppercase tracking-wider text-ink-600">Why tracked · </span>
              {project.trackingReason}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-3 font-mono text-xs text-ink-400">
            {project.websiteUrl ? (
              <a href={project.websiteUrl} target="_blank" rel="noreferrer" className="hover:text-accent">
                website
              </a>
            ) : null}
            {project.twitterUrl ? (
              <a href={project.twitterUrl} target="_blank" rel="noreferrer" className="hover:text-accent">
                social
              </a>
            ) : null}
            <span>{project.primaryChain ?? "—"}</span>
            <span>{(project.primaryCategory ?? "").replace(/_/g, " ")}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-1">
            {project.tags.map((t) => (
              <span key={t.id} className="rounded-sm border border-ink-700 px-1.5 py-0.5 font-mono text-[10px] text-ink-400">
                {t.name}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/projects/${project.slug}/edit`} className="btn">
            Edit
          </Link>
          <form action={toggleWatchlistAction}>
            <input type="hidden" name="projectId" value={project.id} />
            <input type="hidden" name="slug" value={project.slug} />
            <button type="submit" className="btn">
              {project.onWatchlist ? "Unwatch" : "Watch"}
            </button>
          </form>
          <form action={deleteProjectAction}>
            <input type="hidden" name="id" value={project.id} />
            <button type="submit" className="btn btn-danger">
              Delete
            </button>
          </form>
        </div>
      </header>

      {/* Recency */}
      <section>
        <h2 className="section-title">Recency</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {ACTIVITY_SIGNAL_TYPES.map((type) => {
            const sig = signalMap[type];
            const badge = recencyBadge(sig?.latestAt);
            return (
              <div key={type} className="panel p-3">
                <div className="font-mono text-[10px] uppercase tracking-wider text-ink-500">{type}</div>
                <div className="mt-2">
                  <RecencyPill badge={badge} />
                </div>
                <div className="mt-2 font-mono text-[11px] text-ink-400">
                  {sig?.latestAt ? new Date(sig.latestAt).toISOString().slice(0, 10) : "—"}
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-ink-500">{sig?.summary ?? RECENCY_LABELS[badge]}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Scores */}
      <section>
        <h2 className="section-title">Research scores</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {SCORE_DIMENSIONS.map((dim) => {
            const sc = scoreMap[dim];
            return (
              <div key={dim} className="panel p-3">
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-ink-500">
                    {dim.replace(/_/g, " ")}
                  </span>
                  <span className="font-mono text-lg text-accent">{sc?.score ?? "—"}</span>
                </div>
                <p className="mt-1 text-xs text-ink-500">{sc?.explanation ?? "Not scored"}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Tokens */}
      <section>
        <h2 className="section-title">Tokens</h2>
        <div className="mt-3 panel overflow-x-auto">
          <table className="table-dense">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Status</th>
                <th>Role</th>
                <th>Chain</th>
                <th>Contract</th>
                <th>Current</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {project.tokens.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-ink-500">
                    No tokens — pre-token
                  </td>
                </tr>
              ) : (
                project.tokens.map((t) => (
                  <tr key={t.id}>
                    <td className="font-mono">{t.symbol ?? "—"}</td>
                    <td>
                      <StatusPill status={t.tokenStatus} />
                    </td>
                    <td className="text-ink-400">{t.tokenRole}</td>
                    <td className="font-mono text-xs">{t.chain}</td>
                    <td className="max-w-[180px] truncate font-mono text-[11px] text-ink-400">
                      {t.contractAddress ?? "—"}
                    </td>
                    <td>{t.isCurrent ? "yes" : "no"}</td>
                    <td className="max-w-[140px] truncate text-xs">
                      {t.sourceUrl ? (
                        <a href={t.sourceUrl} className="text-accent" target="_blank" rel="noreferrer">
                          source
                        </a>
                      ) : (
                        <span className="text-warn">missing</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <form action={addTokenAction} className="mt-3 grid gap-2 panel p-3 sm:grid-cols-3 lg:grid-cols-6">
          <input type="hidden" name="projectId" value={project.id} />
          <input type="hidden" name="slug" value={project.slug} />
          <input className="input" name="symbol" placeholder="Symbol" />
          <input className="input" name="contractAddress" placeholder="0x… CA" />
          <select className="input" name="chain" defaultValue={project.primaryChain ?? "base"}>
            {CHAINS.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
          <input className="input" name="chainId" defaultValue={String(project.primaryChainId ?? 8453)} placeholder="chainId" />
          <select className="input" name="tokenStatus" defaultValue="unknown">
            {TOKEN_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select className="input" name="tokenRole" defaultValue="primary">
            {TOKEN_ROLES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input className="input sm:col-span-2" name="sourceUrl" placeholder="Source URL (required if CA)" />
          <label className="flex items-center gap-2 text-xs text-ink-400">
            <input type="checkbox" name="isCurrent" defaultChecked /> Current
          </label>
          <button type="submit" className="btn btn-primary">
            Add token
          </button>
        </form>
      </section>

      {/* GitHub */}
      <section>
        <h2 className="section-title">GitHub</h2>
        <ul className="mt-3 space-y-2">
          {project.repositories.map((r) => (
            <li key={r.id} className="panel flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <a href={r.url} target="_blank" rel="noreferrer" className="font-mono text-sm text-accent">
                {r.owner}/{r.repo}
              </a>
              <span className="font-mono text-[10px] uppercase text-ink-500">{r.repoRole}</span>
              <span className="text-xs text-ink-500">
                {r.identityVerified ? "verified" : "unverified"} · stars {r.stars ?? 0}
              </span>
            </li>
          ))}
          {project.repositories.length === 0 ? (
            <li className="text-sm text-ink-500">No repos attached</li>
          ) : null}
        </ul>
        <form action={addRepoAction} className="mt-3 flex flex-wrap gap-2 panel p-3">
          <input type="hidden" name="projectId" value={project.id} />
          <input type="hidden" name="slug" value={project.slug} />
          <input className="input w-32" name="owner" placeholder="owner" required />
          <input className="input w-40" name="repo" placeholder="repo" required />
          <select className="input w-auto" name="repoRole" defaultValue="core">
            {REPO_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-xs text-ink-400">
            <input type="checkbox" name="identityVerified" /> Verified
          </label>
          <button type="submit" className="btn">
            Add repo
          </button>
        </form>
      </section>

      {/* Timeline */}
      <section>
        <h2 className="section-title">Activity timeline</h2>
        <ol className="mt-3 space-y-0 border-l border-ink-700 pl-4">
          {project.events.map((e) => (
            <li key={e.id} className="relative pb-4">
              <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border border-accent bg-ink-950" />
              <div className="font-mono text-[10px] text-ink-500">
                {new Date(e.timestamp).toISOString().slice(0, 16).replace("T", " ")} · {e.eventType} · {e.severity}
              </div>
              <div className="text-sm text-ink-100">{e.title}</div>
              {e.description ? <p className="text-xs text-ink-500">{e.description}</p> : null}
            </li>
          ))}
          {project.events.length === 0 ? <li className="text-sm text-ink-500">No events yet</li> : null}
        </ol>
        <form action={addEventAction} className="mt-3 grid gap-2 panel p-3 sm:grid-cols-2">
          <input type="hidden" name="projectId" value={project.id} />
          <input type="hidden" name="slug" value={project.slug} />
          <input className="input" name="title" placeholder="Title" required />
          <select className="input" name="eventType" defaultValue="manual_note">
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input className="input" name="timestamp" type="datetime-local" />
          <select className="input" name="severity" defaultValue="info">
            {EVENT_SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input className="input sm:col-span-2" name="description" placeholder="Description" />
          <input className="input sm:col-span-2" name="sourceUrl" placeholder="Source URL" />
          <button type="submit" className="btn btn-primary">
            Add event
          </button>
        </form>
      </section>

      {/* Evidence + notes */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="section-title">Evidence</h2>
          <ul className="mt-3 space-y-2">
            {project.evidence.map((e) => (
              <li key={e.id} className="panel p-3 text-sm">
                <div className="font-mono text-[10px] uppercase text-ink-500">
                  {e.claimField} · conf {e.confidence}/10
                </div>
                <div className="text-ink-200">{e.claimValue}</div>
                <a href={e.sourceUrl} className="text-xs text-accent" target="_blank" rel="noreferrer">
                  {e.sourceUrl}
                </a>
              </li>
            ))}
          </ul>
          <form action={addEvidenceAction} className="mt-3 space-y-2 panel p-3">
            <input type="hidden" name="projectId" value={project.id} />
            <input type="hidden" name="slug" value={project.slug} />
            <input className="input" name="claimField" placeholder="claim field (e.g. token_contract)" required />
            <input className="input" name="claimValue" placeholder="value" required />
            <input className="input" name="sourceUrl" placeholder="source URL" required />
            <input className="input" name="confidence" type="number" min={0} max={10} defaultValue={5} />
            <button type="submit" className="btn">
              Add evidence
            </button>
          </form>
        </section>

        <section>
          <h2 className="section-title">Notes</h2>
          <ul className="mt-3 space-y-2">
            {project.notes.map((n) => (
              <li key={n.id} className="panel p-3 text-sm text-ink-300">
                <div className="font-mono text-[10px] text-ink-600">
                  {new Date(n.createdAt).toISOString().slice(0, 10)} · {n.author}
                </div>
                <p className="mt-1 whitespace-pre-wrap">{n.body}</p>
              </li>
            ))}
          </ul>
          <form action={addNoteAction} className="mt-3 space-y-2 panel p-3">
            <input type="hidden" name="projectId" value={project.id} />
            <input type="hidden" name="slug" value={project.slug} />
            <textarea className="input min-h-[80px]" name="body" required />
            <button type="submit" className="btn">
              Add note
            </button>
          </form>
        </section>
      </div>

      {/* Manual signal / score forms */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="section-title">Update activity signal</h2>
          <form action={upsertSignalAction} className="mt-3 space-y-2 panel p-3">
            <input type="hidden" name="projectId" value={project.id} />
            <input type="hidden" name="slug" value={project.slug} />
            <select className="input" name="signalType" defaultValue="code">
              {ACTIVITY_SIGNAL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input className="input" name="latestAt" type="datetime-local" />
            <input className="input" name="summary" placeholder="Summary" />
            <input className="input" name="confidence" type="number" defaultValue={5} min={0} max={10} />
            <button type="submit" className="btn btn-primary">
              Save signal
            </button>
          </form>
        </section>
        <section>
          <h2 className="section-title">Update score</h2>
          <form action={upsertScoreAction} className="mt-3 space-y-2 panel p-3">
            <input type="hidden" name="projectId" value={project.id} />
            <input type="hidden" name="slug" value={project.slug} />
            <select className="input" name="dimension" defaultValue="identity_confidence">
              {SCORE_DIMENSIONS.map((d) => (
                <option key={d} value={d}>
                  {d.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <input className="input" name="score" type="number" min={0} max={10} required placeholder="0–10" />
            <input className="input" name="explanation" placeholder="Why" />
            <input className="input" name="evidenceSource" placeholder="Evidence / source" />
            <button type="submit" className="btn btn-primary">
              Save score
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
