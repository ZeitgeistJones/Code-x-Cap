import Link from "next/link";
import {
  moveCandidateToResearchingAction,
  promoteCandidateAction,
  rejectCandidateAction,
} from "@/app/actions/candidates";
import { StatusPill } from "@/components/Badges";
import { listCandidateProjects } from "@/lib/queries";

export const dynamic = "force-dynamic";

function ChecklistItem({ missing, children }: { missing: boolean; children: React.ReactNode }) {
  return (
    <li className={missing ? "text-warn" : "text-accent"}>
      <span className="mr-1.5 font-mono">{missing ? "MISSING" : "READY"}</span>
      {children}
    </li>
  );
}

export default async function CandidateReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const [candidates, message] = await Promise.all([listCandidateProjects(), searchParams]);

  return (
    <div className="space-y-6">
      <header>
        <p className="font-mono text-[10px] uppercase tracking-widest text-ink-500">Private admin</p>
        <h1 className="font-display text-2xl text-ink-100">Candidate review</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-400">
          Human review gate for projects that are not yet admitted to tracking. Missing evidence
          stays unknown; it is never inferred.
        </p>
      </header>

      {message.ok ? (
        <div className="panel border-accent/40 p-3 text-sm text-accent">{message.ok}</div>
      ) : null}
      {message.error ? (
        <div className="panel border-warn/40 p-3 text-sm text-warn">{message.error}</div>
      ) : null}

      {candidates.length === 0 ? (
        <div className="panel p-8 text-center text-sm text-ink-500">
          No candidate, researching, pre-token, or unverified projects.
        </div>
      ) : (
        <div className="space-y-4">
          {candidates.map((candidate) => {
            const token = candidate.currentToken;
            const publicRepos = candidate.repositories.filter((repo) => !repo.privateOrMissing);
            const missing = candidate.missingBeforeTracking;

            return (
              <article key={candidate.id} className="panel p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/projects/${candidate.slug}`}
                        className="font-display text-lg text-ink-100 hover:text-accent"
                      >
                        {candidate.name}
                      </Link>
                      <StatusPill status={candidate.projectStatus} />
                    </div>
                    <p className="mt-1 max-w-3xl text-sm text-ink-400">
                      {candidate.shortDescription?.trim() || "Description unknown / not verified."}
                    </p>
                  </div>
                  <div className="font-mono text-xs text-ink-400">
                    Identity {candidate.identityConfidence ?? 0}/10
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-3">
                  <section>
                    <h2 className="section-title">Identity and links</h2>
                    <ul className="mt-2 space-y-1 text-xs">
                      <li>
                        Website:{" "}
                        {candidate.websiteUrl ? (
                          <a
                            href={candidate.websiteUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-accent hover:underline"
                          >
                            source
                          </a>
                        ) : (
                          <span className="text-ink-500">unknown / not verified</span>
                        )}
                      </li>
                      <li>
                        Social:{" "}
                        {candidate.twitterUrl ? (
                          <a
                            href={candidate.twitterUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-accent hover:underline"
                          >
                            source
                          </a>
                        ) : (
                          <span className="text-ink-500">unknown / not verified</span>
                        )}
                      </li>
                      <li>
                        GitHub:{" "}
                        {publicRepos.length > 0 ? (
                          publicRepos.map((repo, index) => (
                            <span key={repo.id}>
                              {index > 0 ? ", " : ""}
                              <a
                                href={repo.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-accent hover:underline"
                              >
                                {repo.owner}/{repo.repo}
                              </a>
                            </span>
                          ))
                        ) : (
                          <span className="text-ink-500">unknown / not verified</span>
                        )}
                      </li>
                      <li>
                        Latest GitHub activity:{" "}
                        <span className="text-ink-300">
                          {candidate.latestGithubAt
                            ? candidate.latestGithubAt.toISOString().slice(0, 10)
                            : "unknown / not verified"}
                        </span>
                      </li>
                    </ul>
                  </section>

                  <section>
                    <h2 className="section-title">Current token</h2>
                    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                      <dt className="text-ink-500">Symbol</dt>
                      <dd>{token?.symbol || "unknown / not verified"}</dd>
                      <dt className="text-ink-500">Chain</dt>
                      <dd>{token?.chain || candidate.primaryChain || "unknown / not verified"}</dd>
                      <dt className="text-ink-500">Contract</dt>
                      <dd className="break-all font-mono text-[10px]">
                        {token?.contractAddress || "unknown / not verified"}
                      </dd>
                      <dt className="text-ink-500">CA source</dt>
                      <dd>
                        {token?.sourceUrl ? (
                          <a
                            href={token.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-accent hover:underline"
                          >
                            source
                          </a>
                        ) : (
                          <span className="text-ink-500">unknown / not verified</span>
                        )}
                      </dd>
                    </dl>
                  </section>

                  <section>
                    <h2 className="section-title">Missing before tracking</h2>
                    <ul className="mt-2 space-y-1 text-xs">
                      <ChecklistItem missing={missing.officialIdentitySource}>
                        official project identity source
                      </ChecklistItem>
                      <ChecklistItem missing={missing.publicGithubRepository}>
                        relevant public GitHub repository
                      </ChecklistItem>
                      <ChecklistItem missing={missing.exactContractSource}>
                        exact chain + contract source
                      </ChecklistItem>
                      <ChecklistItem missing={missing.writtenReasonToTrack}>
                        written reason to track
                      </ChecklistItem>
                    </ul>
                  </section>
                </div>

                <section className="mt-4">
                  <h2 className="section-title">Evidence sources</h2>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {candidate.evidence.length > 0 ? (
                      candidate.evidence.map((item) => (
                        <a
                          key={item.id}
                          href={item.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-[10px] text-accent hover:underline"
                          title={item.claimValue}
                        >
                          {item.claimField.replace(/_/g, " ")}
                        </a>
                      ))
                    ) : (
                      <span className="text-xs text-ink-500">unknown / not verified</span>
                    )}
                  </div>
                </section>

                <div className="mt-5 flex flex-wrap items-end gap-2 border-t border-ink-800 pt-4">
                  <form action={promoteCandidateAction}>
                    <input type="hidden" name="projectId" value={candidate.id} />
                    <button type="submit" className="btn btn-primary">
                      Promote to watch
                    </button>
                  </form>
                  <form action={moveCandidateToResearchingAction}>
                    <input type="hidden" name="projectId" value={candidate.id} />
                    <button type="submit" className="btn">
                      Move to researching
                    </button>
                  </form>
                  <form action={rejectCandidateAction} className="flex flex-wrap gap-2">
                    <input type="hidden" name="projectId" value={candidate.id} />
                    <input
                      name="note"
                      aria-label={`Rejection note for ${candidate.name}`}
                      className="input min-w-64"
                      maxLength={500}
                      placeholder="Required rejection note"
                      required
                    />
                    <button type="submit" className="btn btn-danger">
                      Reject
                    </button>
                  </form>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
