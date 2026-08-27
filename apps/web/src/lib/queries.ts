import {
  activitySignals,
  evidence,
  events,
  githubActivities,
  githubRepositories,
  notes,
  projectTags,
  projects,
  researchScores,
  tags,
  tokens,
  watchlistItems,
} from "@codexcap/db/schema";
import {
  and,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
import { codeDisplayForProject, pickPrimaryRepo, recencyBadge } from "@codexcap/core";
import { db } from "@/lib/db";
import {
  buildSignalCopy,
  classifyBuildEvidence,
  classifyIdentity,
  classifyMarketContext,
  type BuildEvidenceLabel,
  type BuildSignalEventType,
  type IdentityLabel,
  type MarketContextLabel,
} from "@/lib/buildSignals";
import { projectGithubStats } from "@/lib/github";
import { latestSnapshotsByTokenIds } from "@/lib/market";
import { ensureSchemaReady } from "@/lib/schema-ready";

export type ProjectFilters = {
  q?: string;
  status?: string;
  category?: string;
  chain?: string;
  tokenStatus?: string;
  tag?: string;
  identityMin?: number;
  preToken?: boolean;
  migration?: boolean;
  watchlist?: boolean;
  codeRecency?: string; // hot|active|cooling|dormant|unknown
};

export async function listProjects(filters: ProjectFilters = {}) {
  await ensureSchemaReady();
  const database = db();

  const watchRows = filters.watchlist
    ? await database.select({ projectId: watchlistItems.projectId }).from(watchlistItems)
    : [];
  const watchIds = watchRows.map((r) => r.projectId);

  const conditions = [];
  if (filters.q) {
    const q = `%${filters.q}%`;
    conditions.push(
      or(
        ilike(projects.name, q),
        ilike(projects.slug, q),
        ilike(projects.websiteUrl, q),
        ilike(projects.shortDescription, q),
      ),
    );
  }
  if (filters.status) conditions.push(eq(projects.projectStatus, filters.status));
  if (filters.category) conditions.push(eq(projects.primaryCategory, filters.category));
  if (filters.chain) {
    conditions.push(
      or(eq(projects.primaryChain, filters.chain), eq(sql`${projects.primaryChainId}::text`, filters.chain)),
    );
  }
  if (filters.identityMin != null && !Number.isNaN(filters.identityMin)) {
    conditions.push(sql`${projects.identityConfidence} >= ${filters.identityMin}`);
  }
  if (filters.preToken) {
    conditions.push(
      or(eq(projects.projectStatus, "pre_token"), eq(projects.projectStatus, "candidate")),
    );
  }
  if (filters.migration) {
    conditions.push(eq(projects.projectStatus, "migration"));
  }
  if (filters.watchlist) {
    if (watchIds.length === 0) return [];
    conditions.push(inArray(projects.id, watchIds));
  }

  const where = conditions.length ? and(...conditions) : undefined;

  const rows = await database
    .select()
    .from(projects)
    .where(where)
    .orderBy(desc(projects.updatedAt));

  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);

  const [tokenRows, tagRows, signalRows, watchSet, repoRows] = await Promise.all([
    database.select().from(tokens).where(inArray(tokens.projectId, ids)),
    database
      .select({
        projectId: projectTags.projectId,
        tagId: tags.id,
        slug: tags.slug,
        name: tags.name,
        group: tags.group,
      })
      .from(projectTags)
      .innerJoin(tags, eq(projectTags.tagId, tags.id))
      .where(inArray(projectTags.projectId, ids)),
    database.select().from(activitySignals).where(inArray(activitySignals.projectId, ids)),
    database.select().from(watchlistItems).where(inArray(watchlistItems.projectId, ids)),
    database.select().from(githubRepositories).where(inArray(githubRepositories.projectId, ids)),
  ]);

  const watched = new Set(watchSet.map((w) => w.projectId));

  const tokenIds = tokenRows.filter((t) => t.isCurrent || true).map((t) => t.id);
  const snapMap = await latestSnapshotsByTokenIds(tokenIds);

  let result = rows.map((p) => {
    const pTokens = tokenRows.filter((t) => t.projectId === p.id);
    const current = pTokens.find((t) => t.isCurrent) ?? pTokens[0];
    const pTags = tagRows.filter((t) => t.projectId === p.id);
    const signals = signalRows.filter((s) => s.projectId === p.id);
    const codeSignal = signals.find((s) => s.signalType === "code");
    const productSignal = signals.find((s) => s.signalType === "product");
    const market = current ? snapMap.get(current.id) ?? null : null;
    const pRepos = repoRows.filter((r) => r.projectId === p.id);
    const primary = pickPrimaryRepo(pRepos);
    const metrics = (codeSignal?.metrics ?? null) as Record<string, number | null> | null;

    const latestMeaningful =
      pRepos
        .map((r) => r.latestMeaningfulCommitAt)
        .filter((d): d is Date => !!d)
        .sort((a, b) => b.getTime() - a.getTime())[0] ?? codeSignal?.latestAt ?? null;

    const latestCommit =
      pRepos
        .map((r) => r.latestCommitAt)
        .filter((d): d is Date => !!d)
        .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

    const codeDisplay = codeDisplayForProject({
      buildVisibility: p.buildVisibility,
      latestMeaningfulAt: latestMeaningful,
      latestCommitAt: latestCommit,
      hasPublicRepo: pRepos.length > 0,
    });

    return {
      ...p,
      tags: pTags,
      tokens: pTokens,
      currentToken: current ?? null,
      market,
      signals,
      repositories: pRepos,
      primaryRepo: primary,
      codeMetrics: metrics,
      codeDisplay,
      codeRecency: codeDisplay.openRecency ?? recencyBadge(latestMeaningful ?? latestCommit),
      productRecency: recencyBadge(productSignal?.latestAt),
      lastMeaningfulBuild: latestMeaningful,
      codeSummary: codeSignal?.summary ?? null,
      onWatchlist: watched.has(p.id),
    };
  });

  if (filters.tokenStatus) {
    result = result.filter((p) => p.tokens.some((t) => t.tokenStatus === filters.tokenStatus));
  }
  if (filters.tag) {
    result = result.filter((p) => p.tags.some((t) => t.slug === filters.tag));
  }
  if (filters.codeRecency) {
    result = result.filter((p) => {
      if (p.codeDisplay.mode !== "open_recency") return false;
      return p.codeRecency === filters.codeRecency;
    });
  }
  if (filters.preToken) {
    result = result.filter((p) => p.tokens.length === 0 || p.projectStatus === "pre_token");
  }

  const priorityRank: Record<string, number> = {
    very_high: 0,
    high: 1,
    special_situation: 2,
    medium: 3,
    low: 4,
  };
  result.sort((a, b) => {
    const pa = priorityRank[a.researchPriority ?? "medium"] ?? 3;
    const pb = priorityRank[b.researchPriority ?? "medium"] ?? 3;
    if (pa !== pb) return pa - pb;
    return (b.updatedAt?.getTime?.() ?? 0) - (a.updatedAt?.getTime?.() ?? 0);
  });

  return result;
}

export async function getProjectBySlug(slug: string) {
  await ensureSchemaReady();
  const database = db();
  const [project] = await database.select().from(projects).where(eq(projects.slug, slug)).limit(1);
  if (!project) return null;

  const [
    tokenRows,
    repoRows,
    evidenceRows,
    noteRows,
    eventRows,
    signalRows,
    scoreRows,
    tagRows,
    watchRow,
  ] = await Promise.all([
    database.select().from(tokens).where(eq(tokens.projectId, project.id)).orderBy(desc(tokens.isCurrent)),
    database.select().from(githubRepositories).where(eq(githubRepositories.projectId, project.id)),
    database.select().from(evidence).where(eq(evidence.projectId, project.id)).orderBy(desc(evidence.createdAt)),
    database.select().from(notes).where(eq(notes.projectId, project.id)).orderBy(desc(notes.createdAt)),
    database.select().from(events).where(eq(events.projectId, project.id)).orderBy(desc(events.timestamp)),
    database.select().from(activitySignals).where(eq(activitySignals.projectId, project.id)),
    database.select().from(researchScores).where(eq(researchScores.projectId, project.id)),
    database
      .select({
        id: tags.id,
        slug: tags.slug,
        name: tags.name,
        group: tags.group,
      })
      .from(projectTags)
      .innerJoin(tags, eq(projectTags.tagId, tags.id))
      .where(eq(projectTags.projectId, project.id)),
    database.select().from(watchlistItems).where(eq(watchlistItems.projectId, project.id)).limit(1),
  ]);

  const snapMap = await latestSnapshotsByTokenIds(tokenRows.map((t) => t.id));
  const tokensWithMarket = tokenRows.map((t) => ({
    ...t,
    latestMarket: snapMap.get(t.id) ?? null,
  }));
  const current = tokensWithMarket.find((t) => t.isCurrent) ?? tokensWithMarket[0] ?? null;

  return {
    ...project,
    tokens: tokensWithMarket,
    currentToken: current,
    market: current?.latestMarket ?? null,
    repositories: repoRows,
    github: await projectGithubStats(project.id),
    evidence: evidenceRows,
    notes: noteRows,
    events: eventRows,
    signals: signalRows,
    scores: scoreRows,
    tags: tagRows,
    onWatchlist: watchRow.length > 0,
  };
}

export async function listAllTags() {
  return db().select().from(tags).orderBy(tags.group, tags.name);
}

export async function searchGlobal(q: string) {
  if (!q.trim()) return { projects: [], tokens: [], repos: [] };
  const database = db();
  const like = `%${q}%`;
  const exactAddr = q.trim().toLowerCase();

  const [proj, tok, repos] = await Promise.all([
    database
      .select()
      .from(projects)
      .where(
        or(
          ilike(projects.name, like),
          ilike(projects.slug, like),
          ilike(projects.websiteUrl, like),
        ),
      )
      .limit(20),
    database
      .select()
      .from(tokens)
      .where(
        or(
          ilike(tokens.symbol, like),
          sql`lower(${tokens.contractAddress}) = ${exactAddr}`,
          ilike(tokens.contractAddress, like),
        ),
      )
      .limit(20),
    database
      .select()
      .from(githubRepositories)
      .where(or(ilike(githubRepositories.owner, like), ilike(githubRepositories.repo, like), ilike(githubRepositories.url, like)))
      .limit(20),
  ]);

  return { projects: proj, tokens: tok, repos };
}

const CANDIDATE_STATUSES = ["candidate", "researching", "pre_token", "unverified"];

/** Private review queue data, loaded in batches to avoid per-candidate queries. */
export async function listCandidateProjects() {
  await ensureSchemaReady();
  const database = db();
  const projectRows = await database
    .select()
    .from(projects)
    .where(inArray(projects.projectStatus, CANDIDATE_STATUSES))
    .orderBy(desc(projects.updatedAt));

  if (projectRows.length === 0) return [];
  const projectIds = projectRows.map((project) => project.id);
  const [tokenRows, repoRows, evidenceRows] = await Promise.all([
    database
      .select()
      .from(tokens)
      .where(and(inArray(tokens.projectId, projectIds), eq(tokens.isCurrent, true))),
    database.select().from(githubRepositories).where(inArray(githubRepositories.projectId, projectIds)),
    database.select().from(evidence).where(inArray(evidence.projectId, projectIds)),
  ]);

  return projectRows.map((project) => {
    const currentToken = tokenRows.find((token) => token.projectId === project.id) ?? null;
    const repositories = repoRows.filter((repository) => repository.projectId === project.id);
    const projectEvidence = evidenceRows.filter((item) => item.projectId === project.id);
    const publicRepositories = repositories.filter((repository) => !repository.privateOrMissing);
    const latestGithubAt =
      repositories
        .flatMap((repository) =>
          [repository.latestMeaningfulCommitAt, repository.latestCommitAt].filter(
            (value): value is Date => Boolean(value),
          ),
        )
        .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

    return {
      ...project,
      currentToken,
      repositories,
      evidence: projectEvidence,
      latestGithubAt,
      missingBeforeTracking: {
        officialIdentitySource: !Boolean(project.websiteUrl || project.twitterUrl),
        publicGithubRepository: publicRepositories.length === 0,
        exactContractSource: !Boolean(
          currentToken?.contractAddress?.trim() && currentToken.sourceUrl?.trim(),
        ),
        writtenReasonToTrack: !Boolean(project.trackingReason?.trim()),
      },
    };
  });
}

export interface RecentBuildSignalFilters {
  since: Date;
  limit: number;
  buildEvidence?: BuildEvidenceLabel;
  identity?: IdentityLabel;
  market?: MarketContextLabel;
}

const BUILD_SIGNAL_EVENT_TYPES: BuildSignalEventType[] = [
  "meaningful_commit",
  "release",
  "product_launch",
  "liquidity_threshold",
  "market_cap_threshold",
  "token_migration",
  "repo_private",
  "dormant",
];

function eventScore(metadata: Record<string, unknown> | null, description: string | null) {
  const value = metadata?.score;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const match = description?.match(/score\s+(\d+(?:\.\d+)?)\/10/i);
  return match ? Number(match[1]) : null;
}

function eventClassification(metadata: Record<string, unknown> | null) {
  const value = metadata?.classification;
  return typeof value === "string" && value.trim() ? value : null;
}

/**
 * Read-only Build Signals feed. All joins are batch queries; mapping and labels
 * are deterministic and happen in memory.
 */
export async function getRecentBuildSignals(filters: RecentBuildSignalFilters) {
  await ensureSchemaReady();
  const database = db();
  const fetchLimit = Math.max(filters.limit * 8, 80);
  const eventRows = await database
    .select()
    .from(events)
    .where(
      and(
        gte(events.timestamp, filters.since),
        inArray(events.eventType, BUILD_SIGNAL_EVENT_TYPES),
        isNotNull(events.sourceUrl),
      ),
    )
    .orderBy(desc(events.timestamp))
    .limit(fetchLimit);

  if (eventRows.length === 0) return [];
  const projectIds = [...new Set(eventRows.map((event) => event.projectId))];
  const projectRows = await database
    .select()
    .from(projects)
    .where(
      and(
        inArray(projects.id, projectIds),
        notInArray(projects.projectStatus, ["rejected", "archived"]),
      ),
    );
  if (projectRows.length === 0) return [];

  const eligibleProjectIds = projectRows.map((project) => project.id);
  const [tokenRows, repoRows] = await Promise.all([
    database
      .select()
      .from(tokens)
      .where(and(inArray(tokens.projectId, eligibleProjectIds), eq(tokens.isCurrent, true))),
    database
      .select()
      .from(githubRepositories)
      .where(inArray(githubRepositories.projectId, eligibleProjectIds)),
  ]);
  const repositoryIds = repoRows.map((repository) => repository.id);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);
  const meaningfulActivities =
    repositoryIds.length > 0
      ? await database
          .select({
            repositoryId: githubActivities.repositoryId,
            score: githubActivities.meaningfulScore,
          })
          .from(githubActivities)
          .where(
            and(
              inArray(githubActivities.repositoryId, repositoryIds),
              gte(githubActivities.timestamp, thirtyDaysAgo),
              gte(githubActivities.meaningfulScore, 5),
            ),
          )
      : [];

  const snapshotMap = await latestSnapshotsByTokenIds(tokenRows.map((token) => token.id));
  const projectMap = new Map(projectRows.map((project) => [project.id, project]));
  const groupedDays = new Set(
    eventRows
      .filter((event) => event.metadata?.groupedBuildUpdate === true)
      .map((event) => `${event.projectId}:${event.timestamp.toISOString().slice(0, 10)}`),
  );

  const mapped = eventRows
    .filter((event) => {
      if (!projectMap.has(event.projectId) || !event.sourceUrl) return false;
      if (event.eventType !== "meaningful_commit") return true;
      const score = eventScore(event.metadata, event.description);
      if (score == null || score < 5) return false;
      const dayKey = `${event.projectId}:${event.timestamp.toISOString().slice(0, 10)}`;
      return event.metadata?.groupedBuildUpdate === true || !groupedDays.has(dayKey);
    })
    .map((event) => {
      const project = projectMap.get(event.projectId)!;
      const currentToken = tokenRows.find((token) => token.projectId === project.id) ?? null;
      const snapshot = currentToken ? snapshotMap.get(currentToken.id) ?? null : null;
      const repositories = repoRows.filter((repository) => repository.projectId === project.id);
      const repoIds = new Set(repositories.map((repository) => repository.id));
      const meaningfulCommits30d = meaningfulActivities.filter((activity) =>
        repoIds.has(activity.repositoryId),
      ).length;
      const score = eventScore(event.metadata, event.description);
      const classification = eventClassification(event.metadata);
      const eventType = event.eventType as BuildSignalEventType;
      const buildEvidence = classifyBuildEvidence({
        eventType,
        meaningfulScore: score,
        meaningfulCommits30d,
        verifiedEvent:
          event.confirmed && (eventType === "release" || eventType === "product_launch"),
      });
      const identity = classifyIdentity({
        identityConfidence: project.identityConfidence,
        hasExactContract: Boolean(currentToken?.contractAddress),
        tokenSourceUrl: currentToken?.sourceUrl ?? null,
        contractVerified: currentToken?.contractVerified ?? false,
        hasPublicRepository: repositories.some((repository) => !repository.privateOrMissing),
      });
      const market = classifyMarketContext({
        snapshotAt: snapshot?.timestamp ?? null,
        liquidityUsd: snapshot?.liquidityUsd ? Number(snapshot.liquidityUsd) : null,
      });

      const commitCountRaw = event.metadata?.commitCount;
      const commitCount =
        typeof commitCountRaw === "number" && Number.isFinite(commitCountRaw)
          ? commitCountRaw
          : null;
      const marketCap = snapshot?.marketCap != null ? Number(snapshot.marketCap) : null;
      const liquidityUsd = snapshot?.liquidityUsd != null ? Number(snapshot.liquidityUsd) : null;

      return {
        id: event.id,
        project: {
          id: project.id,
          slug: project.slug,
          name: project.name,
          shortDescription: project.shortDescription,
          trackingReason: project.trackingReason,
          identityConfidence: project.identityConfidence,
        },
        event: {
          type: eventType,
          title: event.title,
          description: event.description,
          timestamp: event.timestamp,
          sourceUrl: event.sourceUrl,
          classification,
          meaningfulScore: score,
          commitCount,
        },
        currentToken,
        marketSnapshot: snapshot,
        labels: { buildEvidence, identity, market },
        copy: buildSignalCopy({
          projectName: project.name,
          eventType,
          eventTitle: event.title,
          eventDescription: event.description,
          classification,
          meaningfulScore: score,
          commitCount,
          happenedAt: event.timestamp,
          shortDescription: project.shortDescription,
          trackingReason: project.trackingReason,
          identityConfidence: project.identityConfidence,
          identityLabel: identity,
          tokenSymbol: currentToken?.symbol ?? null,
          tokenChain: currentToken?.chain ?? null,
          tokenContract: currentToken?.contractAddress ?? null,
          tokenSourceUrl: currentToken?.sourceUrl ?? null,
          contractVerified: currentToken?.contractVerified ?? false,
          marketLabel: market,
          marketCap: Number.isFinite(marketCap) ? marketCap : null,
          liquidityUsd: Number.isFinite(liquidityUsd) ? liquidityUsd : null,
          marketSource: snapshot?.source ?? null,
          marketSnapshotAt: snapshot?.timestamp ?? null,
        }),
      };
    })
    .filter((signal) => {
      if (filters.buildEvidence && signal.labels.buildEvidence !== filters.buildEvidence) return false;
      if (filters.identity && signal.labels.identity !== filters.identity) return false;
      if (filters.market && signal.labels.market !== filters.market) return false;
      return true;
    });

  return mapped.slice(0, Math.max(1, filters.limit));
}
