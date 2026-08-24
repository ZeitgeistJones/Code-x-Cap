import {
  codeDisplayForProject,
  pickPrimaryRepo,
  repoRoleLabel,
} from "@codexcap/core";

export type BuildCodeRepo = {
  owner: string;
  repo: string;
  url: string;
  repoRole: string;
  identityVerified?: boolean | null;
  latestCommitAt?: Date | string | null;
  latestMeaningfulCommitAt?: Date | string | null;
};

export type BuildCodeCellProps = {
  buildVisibility: string | null;
  repos: BuildCodeRepo[];
  meaningful7?: number | null;
  meaningful30?: number | null;
  daysSinceMeaningful?: number | null;
  latestMeaningfulAt?: Date | string | null;
  latestCommitAt?: Date | string | null;
  codeMetrics?: Record<string, number | null> | null;
};

export function BuildCodeCell({
  buildVisibility,
  repos,
  meaningful7,
  meaningful30,
  daysSinceMeaningful,
  latestMeaningfulAt,
  latestCommitAt,
  codeMetrics,
}: BuildCodeCellProps) {
  const primary = pickPrimaryRepo(repos);
  const m7 = meaningful7 ?? codeMetrics?.meaningful7 ?? null;
  const m30 = meaningful30 ?? codeMetrics?.meaningful30 ?? null;
  const days =
    daysSinceMeaningful ??
    codeMetrics?.daysSinceMeaningful ??
    null;

  const display = codeDisplayForProject({
    buildVisibility,
    latestMeaningfulAt: latestMeaningfulAt ?? primary?.latestMeaningfulCommitAt,
    latestCommitAt: latestCommitAt ?? primary?.latestCommitAt,
    hasPublicRepo: repos.length > 0,
  });

  const showOpenCounts = display.mode === "open_recency" && (m7 != null || m30 != null);

  return (
    <div className="min-w-[7.5rem] space-y-0.5" title={display.sublabel ?? display.label}>
      <div className="font-mono text-[10px] uppercase tracking-wider text-ink-200">
        {display.label}
      </div>
      {display.sublabel ? (
        <div className="font-mono text-[10px] text-ink-500">{display.sublabel}</div>
      ) : null}
      {showOpenCounts ? (
        <div className="font-mono text-[10px] text-ink-400">
          {days != null ? <span>{days}d</span> : null}
          {m7 != null && m30 != null ? (
            <span>
              {days != null ? " · " : ""}
              {m7}/{m30}
            </span>
          ) : null}
        </div>
      ) : null}
      {repos.length === 0 ? (
        <div className="font-mono text-[10px] text-ink-600">NO PUBLIC REPO</div>
      ) : (
        <div className="flex flex-wrap gap-1 pt-0.5">
          {repos.slice(0, 3).map((r) => (
            <a
              key={`${r.owner}/${r.repo}`}
              href={r.url}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[10px] uppercase tracking-wider text-accent hover:underline"
              title={`${r.owner}/${r.repo}${r.identityVerified ? " · verified" : ""}`}
            >
              ↗ {repoRoleLabel(r.repoRole)}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
