/**
 * Daily upkeep orchestration.
 * Reuses existing GitHub and exact-contract market refreshers, then groups
 * same-day meaningful commits into one sourced Build update per project.
 */

import { createHash } from "node:crypto";
import { events, jobRuns } from "@codexcap/db/schema";
import { and, asc, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { refreshAllGithub } from "@/lib/github";
import { refreshAllCurrentTokenMarkets } from "@/lib/market";

interface StageCounts {
  processed: number;
  successful: number;
  failed: number;
}

export interface DailyUpkeepResult {
  jobRunId: string;
  status: "succeeded" | "partial" | "failed";
  startedAt: string;
  finishedAt: string;
  github: StageCounts;
  tokens: StageCounts & { skipped: number };
  newEventsCreated: number;
  groupedBuildUpdatesCreated: number;
  errors: string[];
}

function shortError(scope: string, value: unknown): string {
  const message = value instanceof Error ? value.message : String(value);
  return `${scope}: ${message.replace(/\s+/g, " ").slice(0, 180)}`;
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

export async function runDailyUpkeep(): Promise<DailyUpkeepResult> {
  const database = db();
  const startedAt = new Date();
  const [jobRun] = await database
    .insert(jobRuns)
    .values({
      jobName: "daily_upkeep",
      status: "running",
      startedAt,
      recordsProcessed: 0,
      metadata: { startedAt: startedAt.toISOString() },
    })
    .returning({ id: jobRuns.id });

  if (!jobRun) throw new Error("Could not create daily upkeep job run");

  const errors: string[] = [];
  const github: StageCounts = { processed: 0, successful: 0, failed: 0 };
  const tokens: StageCounts & { skipped: number } = {
    processed: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
  };
  let groupedBuildUpdatesCreated = 0;

  try {
    const results = await refreshAllGithub();
    github.processed = results.length;
    github.successful = results.filter((result) => result.ok).length;
    github.failed = results.length - github.successful;
    errors.push(
      ...results
        .filter((result) => !result.ok)
        .map((result) => shortError(`GitHub ${result.fullName}`, result.error ?? "refresh failed")),
    );
  } catch (error) {
    errors.push(shortError("GitHub stage", error));
  }

  try {
    const dayStart = new Date(startedAt);
    dayStart.setUTCHours(0, 0, 0, 0);
    const commitEvents = await database
      .select()
      .from(events)
      .where(and(eq(events.eventType, "meaningful_commit"), gte(events.createdAt, startedAt)))
      .orderBy(asc(events.timestamp));

    const rawCommitEvents = commitEvents.filter(
      (event) => event.metadata?.groupedBuildUpdate !== true && Boolean(event.sourceUrl),
    );
    const byProject = new Map<string, typeof rawCommitEvents>();
    for (const event of rawCommitEvents) {
      const rows = byProject.get(event.projectId) ?? [];
      rows.push(event);
      byProject.set(event.projectId, rows);
    }

    for (const [projectId, projectEvents] of byProject) {
      const newest = projectEvents[projectEvents.length - 1];
      if (!newest?.sourceUrl) continue;

      const shas = projectEvents
        .map((event) => stringFromMetadata(event.metadata, "sha"))
        .filter((sha): sha is string => Boolean(sha))
        .sort();
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
      const digestInput =
        shas.length > 0 ? shas.join(":") : projectEvents.map((event) => event.id).sort().join(":");
      const digest = createHash("sha256").update(digestInput).digest("hex").slice(0, 16);
      const maxScore = scores.length > 0 ? Math.max(...scores) : null;
      const summary = classifications.length
        ? classifications.map((value) => value.replace(/_/g, " ")).join(", ")
        : "public build work";

      const inserted = await database
        .insert(events)
        .values({
          projectId,
          eventType: "meaningful_commit",
          timestamp: newest.timestamp,
          title: "Build update",
          description: `${projectEvents.length} meaningful public commit${
            projectEvents.length === 1 ? "" : "s"
          } recorded today · ${summary}`,
          sourceUrl: newest.sourceUrl,
          severity: "info",
          autoGenerated: true,
          confirmed: true,
          dedupeKey: `build-update-${projectId}-${dayStart.toISOString().slice(0, 10)}-${digest}`,
          metadata: {
            groupedBuildUpdate: true,
            commitCount: projectEvents.length,
            shas,
            scores,
            score: maxScore,
            classifications,
            classification: classifications[0] ?? "build_work",
            jobRunId: jobRun.id,
          },
        })
        .onConflictDoNothing()
        .returning({ id: events.id });
      groupedBuildUpdatesCreated += inserted.length;
    }
  } catch (error) {
    errors.push(shortError("Build update grouping", error));
  }

  try {
    const summary = await refreshAllCurrentTokenMarkets();
    tokens.processed = summary.results.length;
    tokens.successful = summary.results.filter((result) => result.ok).length;
    tokens.failed = summary.results.length - tokens.successful;
    tokens.skipped = summary.skippedNoCa.length;
    errors.push(
      ...summary.results
        .filter((result) => !result.ok)
        .map((result) =>
          shortError(`Market ${result.symbol ?? result.tokenId}`, result.error ?? "refresh failed"),
        ),
    );
  } catch (error) {
    errors.push(shortError("Market stage", error));
  }

  const newEvents = await database
    .select({ id: events.id })
    .from(events)
    .where(gte(events.createdAt, startedAt));

  const processed = github.processed + tokens.processed;
  const stageSucceeded = github.processed > 0 || tokens.processed > 0;
  const status: DailyUpkeepResult["status"] =
    errors.length === 0 ? "succeeded" : stageSucceeded ? "partial" : "failed";
  const finishedAt = new Date();
  const errorSummary = errors.length > 0 ? errors.slice(0, 8).join(" | ").slice(0, 1_500) : null;

  await database
    .update(jobRuns)
    .set({
      status,
      finishedAt,
      error: errorSummary,
      recordsProcessed: processed,
      metadata: {
        github,
        tokens,
        newEventsCreated: newEvents.length,
        groupedBuildUpdatesCreated,
        errors,
      },
    })
    .where(eq(jobRuns.id, jobRun.id));

  return {
    jobRunId: jobRun.id,
    status,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    github,
    tokens,
    newEventsCreated: newEvents.length,
    groupedBuildUpdatesCreated,
    errors,
  };
}
