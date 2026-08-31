/**
 * Resumable daily upkeep orchestration.
 * Each request refreshes at most one repository and one token, then stores its
 * cursor in job_runs.metadata so Vercel's function limit cannot kill the run.
 * After grouping Build updates, optionally rewrites explanations with Gemini
 * one event per request when GEMINI_API_KEY is set.
 */

import { events, githubRepositories, jobRuns, projects, tokens } from "@codexcap/db/schema";
import { and, asc, desc, eq, gte, inArray, isNotNull, notInArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { commitMessageFromDescription, uniqueCommitHeadlines } from "@/lib/buildSignals";
import { explainBuildSignalEvent } from "@/lib/explainBuildSignal";
import { isGeminiConfigured } from "@/lib/geminiExplain";
import { refreshGithubRepository } from "@/lib/github";
import { refreshTokenMarket } from "@/lib/market";

interface StageCounts {
  processed: number;
  successful: number;
  failed: number;
}

interface DailyUpkeepState extends Record<string, unknown> {
  version: 3;
  phase: "refreshing" | "finalizing" | "explaining" | "complete";
  repositoryIds: string[];
  tokenIds: string[];
  repositoryIndex: number;
  tokenIndex: number;
  explainEventIds: string[];
  explainIndex: number;
  explanationsWritten: number;
  github: StageCounts;
  tokens: StageCounts & { skipped: number };
  errors: string[];
  heartbeatAt: string;
  newEventsCreated: number;
  groupedBuildUpdatesCreated: number;
}

export interface DailyUpkeepProgress {
  processed: number;
  total: number;
  githubProcessed: number;
  githubTotal: number;
  tokenProcessed: number;
  tokenTotal: number;
  explainProcessed: number;
  explainTotal: number;
}

export interface DailyUpkeepResult {
  jobRunId: string;
  complete: boolean;
  phase: DailyUpkeepState["phase"];
  status: "running" | "succeeded" | "partial" | "failed";
  startedAt: string;
  finishedAt: string | null;
  progress: DailyUpkeepProgress;
  github: StageCounts;
  tokens: StageCounts & { skipped: number };
  newEventsCreated: number;
  groupedBuildUpdatesCreated: number;
  explanationsWritten: number;
  errors: string[];
}

type Database = ReturnType<typeof db>;
type JobRun = typeof jobRuns.$inferSelect;

const RESUME_WINDOW_MS = 30 * 60 * 1000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EXPLAIN_EVENT_TYPES = [
  "meaningful_commit",
  "release",
  "product_launch",
  "liquidity_threshold",
  "market_cap_threshold",
  "token_migration",
  "repo_private",
  "dormant",
] as const;
const MAX_EXPLAIN_PER_JOB = 12;

function shortError(scope: string, value: unknown): string {
  const message = value instanceof Error ? value.message : String(value);
  return `${scope}: ${message.replace(/\s+/g, " ").slice(0, 180)}`;
}

function addError(state: DailyUpkeepState, error: string): void {
  if (state.errors.length < 100) state.errors.push(error);
}

function numberFromMetadata(
  metadata: Record<string, unknown> | null,
  key: string,
): number | null {
  const value = metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringFromMetadata(
  metadata: Record<string, unknown> | null,
  key: string,
): string | null {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isStageCounts(value: unknown): value is StageCounts {
  if (!value || typeof value !== "object") return false;
  const counts = value as Record<string, unknown>;
  return (
    typeof counts.processed === "number" &&
    typeof counts.successful === "number" &&
    typeof counts.failed === "number"
  );
}

function parseState(metadata: Record<string, unknown> | null): DailyUpkeepState | null {
  if (!metadata || metadata.version !== 3) return null;
  if (
    metadata.phase !== "refreshing" &&
    metadata.phase !== "finalizing" &&
    metadata.phase !== "explaining" &&
    metadata.phase !== "complete"
  ) {
    return null;
  }
  if (
    !Array.isArray(metadata.repositoryIds) ||
    !metadata.repositoryIds.every((value) => typeof value === "string") ||
    !Array.isArray(metadata.tokenIds) ||
    !metadata.tokenIds.every((value) => typeof value === "string") ||
    !Array.isArray(metadata.explainEventIds) ||
    !metadata.explainEventIds.every((value) => typeof value === "string") ||
    typeof metadata.repositoryIndex !== "number" ||
    typeof metadata.tokenIndex !== "number" ||
    typeof metadata.explainIndex !== "number" ||
    typeof metadata.explanationsWritten !== "number" ||
    !isStageCounts(metadata.github) ||
    !isStageCounts(metadata.tokens) ||
    typeof (metadata.tokens as unknown as Record<string, unknown>).skipped !== "number" ||
    !Array.isArray(metadata.errors) ||
    !metadata.errors.every((value) => typeof value === "string") ||
    typeof metadata.heartbeatAt !== "string"
  ) {
    return null;
  }

  return metadata as DailyUpkeepState;
}

function progressFor(state: DailyUpkeepState): DailyUpkeepProgress {
  const refreshProcessed = state.repositoryIndex + state.tokenIndex;
  const refreshTotal = state.repositoryIds.length + state.tokenIds.length;
  return {
    processed: refreshProcessed + state.explainIndex,
    total: refreshTotal + state.explainEventIds.length,
    githubProcessed: state.repositoryIndex,
    githubTotal: state.repositoryIds.length,
    tokenProcessed: state.tokenIndex,
    tokenTotal: state.tokenIds.length,
    explainProcessed: state.explainIndex,
    explainTotal: state.explainEventIds.length,
  };
}

function resultFor(
  run: JobRun,
  state: DailyUpkeepState,
  status: DailyUpkeepResult["status"],
): DailyUpkeepResult {
  return {
    jobRunId: run.id,
    complete: state.phase === "complete",
    phase: state.phase,
    status,
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
    progress: progressFor(state),
    github: state.github,
    tokens: state.tokens,
    newEventsCreated: state.newEventsCreated,
    groupedBuildUpdatesCreated: state.groupedBuildUpdatesCreated,
    explanationsWritten: state.explanationsWritten,
    errors: state.errors,
  };
}

async function createRun(database: Database): Promise<{ run: JobRun; state: DailyUpkeepState }> {
  const currentTokens = await database
    .select({ id: tokens.id, contractAddress: tokens.contractAddress })
    .from(tokens)
    .where(eq(tokens.isCurrent, true))
    .orderBy(asc(tokens.id));
  const repositoryRows = await database
    .select({ id: githubRepositories.id })
    .from(githubRepositories)
    .orderBy(asc(githubRepositories.id));
  const tokenIds = currentTokens
    .filter((token) => Boolean(token.contractAddress?.trim()))
    .map((token) => token.id);
  const skipped = currentTokens.length - tokenIds.length;
  const startedAt = new Date();
  const state: DailyUpkeepState = {
    version: 3,
    phase: "refreshing",
    repositoryIds: repositoryRows.map((repository) => repository.id),
    tokenIds,
    repositoryIndex: 0,
    tokenIndex: 0,
    explainEventIds: [],
    explainIndex: 0,
    explanationsWritten: 0,
    github: { processed: 0, successful: 0, failed: 0 },
    tokens: { processed: 0, successful: 0, failed: 0, skipped },
    errors: [],
    heartbeatAt: startedAt.toISOString(),
    newEventsCreated: 0,
    groupedBuildUpdatesCreated: 0,
  };
  const [run] = await database
    .insert(jobRuns)
    .values({
      jobName: "daily_upkeep",
      status: "running",
      startedAt,
      recordsProcessed: 0,
      metadata: state,
    })
    .returning();

  if (!run) throw new Error("Could not create daily upkeep job run");
  return { run, state };
}

async function failAbandonedRun(database: Database, run: JobRun): Promise<void> {
  await database
    .update(jobRuns)
    .set({
      status: "failed",
      finishedAt: new Date(),
      error: "Interrupted before completion and was not resumed within 30 minutes.",
    })
    .where(and(eq(jobRuns.id, run.id), eq(jobRuns.status, "running")));
}

async function loadOrCreateRun(
  database: Database,
  requestedJobRunId?: string,
): Promise<{ run: JobRun; state: DailyUpkeepState }> {
  if (requestedJobRunId) {
    if (!UUID_PATTERN.test(requestedJobRunId)) throw new Error("Invalid daily upkeep job ID");
    const [run] = await database
      .select()
      .from(jobRuns)
      .where(eq(jobRuns.id, requestedJobRunId))
      .limit(1);
    if (!run || run.jobName !== "daily_upkeep") throw new Error("Daily upkeep job not found");
    const state = parseState(run.metadata);
    if (!state) throw new Error("Daily upkeep job cannot be resumed");
    return { run, state };
  }

  const running = await database
    .select()
    .from(jobRuns)
    .where(and(eq(jobRuns.jobName, "daily_upkeep"), eq(jobRuns.status, "running")))
    .orderBy(desc(jobRuns.startedAt));
  const now = Date.now();

  for (const run of running) {
    const state = parseState(run.metadata);
    const heartbeat = state ? Date.parse(state.heartbeatAt) : Number.NaN;
    if (state && Number.isFinite(heartbeat) && now - heartbeat <= RESUME_WINDOW_MS) {
      return { run, state };
    }
    await failAbandonedRun(database, run);
  }

  return createRun(database);
}

async function saveProgress(
  database: Database,
  runId: string,
  state: DailyUpkeepState,
): Promise<void> {
  state.heartbeatAt = new Date().toISOString();
  await database
    .update(jobRuns)
    .set({
      recordsProcessed: state.repositoryIndex + state.tokenIndex + state.explainIndex,
      metadata: state,
    })
    .where(and(eq(jobRuns.id, runId), eq(jobRuns.status, "running")));
}

async function groupBuildUpdates(
  database: Database,
  run: JobRun,
  state: DailyUpkeepState,
): Promise<number> {
  const since = new Date(run.startedAt);
  since.setUTCDate(since.getUTCDate() - 14);
  const commitEvents = await database
    .select()
    .from(events)
    .where(and(eq(events.eventType, "meaningful_commit"), gte(events.timestamp, since)))
    .orderBy(asc(events.timestamp));
  const rawCommitEvents = commitEvents.filter(
    (event) => event.metadata?.groupedBuildUpdate !== true && Boolean(event.sourceUrl),
  );
  const byProjectDay = new Map<string, typeof rawCommitEvents>();

  for (const event of rawCommitEvents) {
    const day = event.timestamp.toISOString().slice(0, 10);
    const key = `${event.projectId}:${day}`;
    const rows = byProjectDay.get(key) ?? [];
    rows.push(event);
    byProjectDay.set(key, rows);
  }

  let written = 0;
  for (const [key, projectEvents] of byProjectDay) {
    const newest = projectEvents[projectEvents.length - 1];
    if (!newest?.sourceUrl) continue;
    const [projectId, day] = key.split(":");
    if (!projectId || !day) continue;

    const scores = projectEvents
      .map((event) => numberFromMetadata(event.metadata, "score"))
      .filter((score): score is number => score != null);
    const classifications = [
      ...new Set(
        projectEvents
          .map((event) => stringFromMetadata(event.metadata, "classification"))
          .filter((value): value is string => Boolean(value)),
      ),
    ];
    const shas = projectEvents
      .map((event) => stringFromMetadata(event.metadata, "sha"))
      .filter((sha): sha is string => Boolean(sha));
    const commitHeadlines = uniqueCommitHeadlines(
      projectEvents.map((event) => commitMessageFromDescription(event.description)),
    );
    const maxScore = scores.length > 0 ? Math.max(...scores) : null;
    const summary = commitHeadlines.length
      ? commitHeadlines.join("; ")
      : classifications.length
        ? classifications.map((value) => value.replace(/_/g, " ")).join(", ")
        : "public build work";
    const title =
      projectEvents.length > 1 ? `Build update · ${projectEvents.length} commits` : "Build update";
    const description = `${projectEvents.length} meaningful public commit${
      projectEvents.length === 1 ? "" : "s"
    } on ${day} · ${summary}`;
    const dedupeKey = `build-update-${projectId}-${day}`;
    const metadata = {
      groupedBuildUpdate: true,
      commitCount: projectEvents.length,
      commitHeadlines,
      shas,
      scores,
      score: maxScore,
      classifications,
      classification: classifications[0] ?? "build_work",
      jobRunId: run.id,
    };

    const [existing] = await database
      .select({ id: events.id })
      .from(events)
      .where(and(eq(events.projectId, projectId), eq(events.dedupeKey, dedupeKey)))
      .limit(1);

    if (existing) {
      await database
        .update(events)
        .set({
          timestamp: newest.timestamp,
          title,
          description,
          sourceUrl: newest.sourceUrl,
          metadata,
          updatedAt: new Date(),
        })
        .where(eq(events.id, existing.id));
      written += 1;
      continue;
    }

    const inserted = await database
      .insert(events)
      .values({
        projectId,
        eventType: "meaningful_commit",
        timestamp: newest.timestamp,
        title,
        description,
        sourceUrl: newest.sourceUrl,
        severity: "info",
        autoGenerated: true,
        confirmed: true,
        dedupeKey,
        metadata,
      })
      .onConflictDoNothing()
      .returning({ id: events.id });
    written += inserted.length;
  }

  state.groupedBuildUpdatesCreated = written;
  return written;
}

async function collectExplainCandidates(database: Database): Promise<string[]> {
  if (!isGeminiConfigured()) return [];

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 30);
  const activeProjects = await database
    .select({ id: projects.id })
    .from(projects)
    .where(notInArray(projects.projectStatus, ["rejected", "archived"]));
  if (activeProjects.length === 0) return [];

  const rows = await database
    .select({
      id: events.id,
      metadata: events.metadata,
      eventType: events.eventType,
      description: events.description,
    })
    .from(events)
    .where(
      and(
        gte(events.timestamp, since),
        inArray(events.eventType, [...EXPLAIN_EVENT_TYPES]),
        isNotNull(events.sourceUrl),
        inArray(
          events.projectId,
          activeProjects.map((project) => project.id),
        ),
      ),
    )
    .orderBy(desc(events.timestamp))
    .limit(80);

  const needsExplain = rows.filter((row) => {
    if (row.eventType === "meaningful_commit") {
      const score = row.metadata?.score;
      if (typeof score !== "number" || score < 5) return false;
    }
    const ai = row.metadata?.aiExplanation;
    if (!ai || typeof ai !== "object") return true;
    const cached = ai as Record<string, unknown>;
    if (cached.source !== "gemini") return true;
    return typeof cached.fingerprint !== "string" || !cached.fingerprint.startsWith("v3-");
  });

  return needsExplain.slice(0, MAX_EXPLAIN_PER_JOB).map((row) => row.id);
}

async function completeRun(
  database: Database,
  run: JobRun,
  state: DailyUpkeepState,
): Promise<DailyUpkeepResult> {
  const total = state.repositoryIds.length + state.tokenIds.length;
  const successful = state.github.successful + state.tokens.successful;
  if (total === 0) addError(state, "Daily upkeep: no repositories or exact-contract tokens found");
  const status: "succeeded" | "partial" | "failed" =
    state.errors.length === 0 ? "succeeded" : successful > 0 ? "partial" : "failed";
  const finishedAt = new Date();
  state.phase = "complete";
  state.heartbeatAt = finishedAt.toISOString();
  const errorSummary =
    state.errors.length > 0 ? state.errors.slice(0, 8).join(" | ").slice(0, 1_500) : null;

  await database
    .update(jobRuns)
    .set({
      status,
      finishedAt,
      error: errorSummary,
      recordsProcessed: state.repositoryIndex + state.tokenIndex + state.explainIndex,
      metadata: state,
    })
    .where(and(eq(jobRuns.id, run.id), eq(jobRuns.status, "running")));

  return resultFor({ ...run, status, finishedAt }, state, status);
}

async function finalizeRun(
  database: Database,
  run: JobRun,
  state: DailyUpkeepState,
): Promise<DailyUpkeepResult> {
  try {
    await groupBuildUpdates(database, run, state);
  } catch (error) {
    addError(state, shortError("Build update grouping", error));
  }

  try {
    const newEvents = await database
      .select({ id: events.id })
      .from(events)
      .where(gte(events.createdAt, run.startedAt));
    state.newEventsCreated = newEvents.length;
  } catch (error) {
    addError(state, shortError("Event count", error));
  }

  try {
    state.explainEventIds = await collectExplainCandidates(database);
    state.explainIndex = 0;
  } catch (error) {
    addError(state, shortError("Explain candidate collection", error));
    state.explainEventIds = [];
    state.explainIndex = 0;
  }

  if (state.explainEventIds.length === 0) {
    return completeRun(database, run, state);
  }

  state.phase = "explaining";
  await saveProgress(database, run.id, state);
  return resultFor(run, state, "running");
}

async function explainStep(
  database: Database,
  run: JobRun,
  state: DailyUpkeepState,
): Promise<DailyUpkeepResult> {
  const eventId = state.explainEventIds[state.explainIndex];
  if (!eventId) return completeRun(database, run, state);

  try {
    const result = await explainBuildSignalEvent(eventId);
    if (result.ok && result.source === "gemini" && !result.skipped) {
      state.explanationsWritten += 1;
    } else if (!result.ok && result.error && !result.skipped) {
      addError(state, shortError(`Explain ${eventId.slice(0, 8)}`, result.error));
    } else if (result.error === "GEMINI_API_KEY is not set") {
      // No key mid-run — finish without more Gemini attempts.
      state.explainIndex = state.explainEventIds.length;
      return completeRun(database, run, state);
    }
  } catch (error) {
    addError(state, shortError(`Explain ${eventId.slice(0, 8)}`, error));
  }

  state.explainIndex += 1;
  if (state.explainIndex >= state.explainEventIds.length) {
    return completeRun(database, run, state);
  }

  await saveProgress(database, run.id, state);
  return resultFor(run, state, "running");
}

/** Process one bounded upkeep step. Call again with jobRunId until complete. */
export async function runDailyUpkeepStep(jobRunId?: string): Promise<DailyUpkeepResult> {
  const database = db();
  const { run, state } = await loadOrCreateRun(database, jobRunId);

  if (run.status !== "running") {
    const status =
      run.status === "succeeded" || run.status === "partial" || run.status === "failed"
        ? run.status
        : "failed";
    return resultFor(run, state, status);
  }

  if (state.phase === "complete") {
    return resultFor(run, state, "failed");
  }

  if (state.phase === "finalizing") {
    return finalizeRun(database, run, state);
  }

  if (state.phase === "explaining") {
    return explainStep(database, run, state);
  }

  const repositoryId = state.repositoryIds[state.repositoryIndex];
  const tokenId = state.tokenIds[state.tokenIndex];
  const tasks: Array<Promise<void>> = [];

  if (repositoryId) {
    tasks.push(
      refreshGithubRepository(repositoryId)
        .then((result) => {
          state.github.processed += 1;
          if (result.ok) {
            state.github.successful += 1;
          } else {
            state.github.failed += 1;
            addError(
              state,
              shortError(`GitHub ${result.fullName}`, result.error ?? "refresh failed"),
            );
          }
        })
        .catch((error: unknown) => {
          state.github.processed += 1;
          state.github.failed += 1;
          addError(state, shortError(`GitHub repository ${repositoryId}`, error));
        }),
    );
  }

  if (tokenId) {
    tasks.push(
      refreshTokenMarket(tokenId)
        .then((result) => {
          state.tokens.processed += 1;
          if (result.ok) {
            state.tokens.successful += 1;
          } else {
            state.tokens.failed += 1;
            addError(
              state,
              shortError(`Market ${result.symbol ?? result.tokenId}`, result.error ?? "refresh failed"),
            );
          }
        })
        .catch((error: unknown) => {
          state.tokens.processed += 1;
          state.tokens.failed += 1;
          addError(state, shortError(`Market token ${tokenId}`, error));
        }),
    );
  }

  await Promise.all(tasks);
  if (repositoryId) state.repositoryIndex += 1;
  if (tokenId) state.tokenIndex += 1;

  if (
    state.repositoryIndex >= state.repositoryIds.length &&
    state.tokenIndex >= state.tokenIds.length
  ) {
    state.phase = "finalizing";
  }
  await saveProgress(database, run.id, state);

  return resultFor(run, state, "running");
}
