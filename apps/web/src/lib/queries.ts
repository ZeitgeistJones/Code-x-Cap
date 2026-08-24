import {
  activitySignals,
  evidence,
  events,
  githubRepositories,
  notes,
  projectTags,
  projects,
  researchScores,
  tags,
  tokens,
  watchlistItems,
} from "@codexcap/db/schema";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { recencyBadge } from "@codexcap/core";
import { db } from "@/lib/db";
import { projectGithubStats } from "@/lib/github";
import { latestSnapshotsByTokenIds } from "@/lib/market";

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

  const [tokenRows, tagRows, signalRows, watchSet] = await Promise.all([
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

    return {
      ...p,
      tags: pTags,
      tokens: pTokens,
      currentToken: current ?? null,
      market,
      signals,
      codeRecency: recencyBadge(codeSignal?.latestAt),
      productRecency: recencyBadge(productSignal?.latestAt),
      lastMeaningfulBuild: codeSignal?.latestAt ?? null,
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
    result = result.filter((p) => p.codeRecency === filters.codeRecency);
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
