/**
 * Load one Build Signal event with project/token/market context, ask Gemini for
 * a grounded rewrite, and cache it on events.metadata.aiExplanation.
 */

import { events, githubRepositories, projects, tokens } from "@codexcap/db/schema";
import { and, eq } from "drizzle-orm";
import {
  type BuildSignalCopyInput,
  type BuildSignalEventType,
  buildSignalCopy,
  classifyIdentity,
  classifyMarketContext,
  commitMessageFromDescription,
  explanationFingerprint,
  readCachedAiExplanation,
  uniqueCommitHeadlines,
} from "@/lib/buildSignals";
import { db } from "@/lib/db";
import { explainBuildSignalWithGemini, isGeminiConfigured } from "@/lib/geminiExplain";
import { latestSnapshotsByTokenIds } from "@/lib/market";

const BUILD_SIGNAL_EVENT_TYPES = new Set<string>([
  "meaningful_commit",
  "release",
  "product_launch",
  "liquidity_threshold",
  "market_cap_threshold",
  "token_migration",
  "repo_private",
  "dormant",
]);

export type ExplainEventResult = {
  eventId: string;
  ok: boolean;
  skipped: boolean;
  source: "gemini" | "template" | "cache";
  error?: string;
};

function copyInputFromRows(args: {
  project: typeof projects.$inferSelect;
  event: typeof events.$inferSelect;
  token: typeof tokens.$inferSelect | null;
  snapshot: Awaited<ReturnType<typeof latestSnapshotsByTokenIds>> extends Map<string, infer V>
    ? V | null
    : null;
  hasPublicRepository: boolean;
}): BuildSignalCopyInput {
  const { project, event, token, snapshot, hasPublicRepository } = args;
  const identity = classifyIdentity({
    identityConfidence: project.identityConfidence,
    hasExactContract: Boolean(token?.contractAddress),
    tokenSourceUrl: token?.sourceUrl ?? null,
    contractVerified: token?.contractVerified ?? false,
    hasPublicRepository,
  });
  const market = classifyMarketContext({
    snapshotAt: snapshot?.timestamp ?? null,
    liquidityUsd: snapshot?.liquidityUsd != null ? Number(snapshot.liquidityUsd) : null,
  });
  const score = event.metadata?.score;
  const classification = event.metadata?.classification;
  const commitCount = event.metadata?.commitCount;
  const marketCap = snapshot?.marketCap != null ? Number(snapshot.marketCap) : null;
  const liquidityUsd = snapshot?.liquidityUsd != null ? Number(snapshot.liquidityUsd) : null;

  const commitHeadlinesRaw = event.metadata?.commitHeadlines;
  const commitHeadlines = uniqueCommitHeadlines([
    ...(Array.isArray(commitHeadlinesRaw)
      ? commitHeadlinesRaw.map((item) => (typeof item === "string" ? item : null))
      : []),
    commitMessageFromDescription(event.description),
  ]);

  return {
    projectName: project.name,
    projectStatus: project.projectStatus,
    eventType: event.eventType as BuildSignalEventType,
    eventTitle: event.title,
    eventDescription: event.description,
    classification: typeof classification === "string" ? classification : null,
    meaningfulScore: typeof score === "number" ? score : null,
    commitCount: typeof commitCount === "number" ? commitCount : null,
    commitHeadlines,
    happenedAt: event.timestamp,
    shortDescription: project.shortDescription,
    trackingReason: project.trackingReason,
    identityConfidence: project.identityConfidence,
    identityLabel: identity,
    tokenSymbol: token?.symbol ?? null,
    tokenChain: token?.chain ?? null,
    tokenContract: token?.contractAddress ?? null,
    tokenSourceUrl: token?.sourceUrl ?? null,
    contractVerified: token?.contractVerified ?? false,
    marketLabel: market,
    marketCap: Number.isFinite(marketCap) ? marketCap : null,
    liquidityUsd: Number.isFinite(liquidityUsd) ? liquidityUsd : null,
    marketSource: snapshot?.source ?? null,
    marketSnapshotAt: snapshot?.timestamp ?? null,
  };
}

export async function explainBuildSignalEvent(eventId: string): Promise<ExplainEventResult> {
  const database = db();
  const [event] = await database.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (!event) {
    return { eventId, ok: false, skipped: true, source: "template", error: "event not found" };
  }
  if (!BUILD_SIGNAL_EVENT_TYPES.has(event.eventType) || !event.sourceUrl) {
    return {
      eventId,
      ok: false,
      skipped: true,
      source: "template",
      error: "event is not an eligible Build Signal",
    };
  }

  const [project] = await database
    .select()
    .from(projects)
    .where(eq(projects.id, event.projectId))
    .limit(1);
  if (!project) {
    return { eventId, ok: false, skipped: true, source: "template", error: "project not found" };
  }

  const [token] =
    (await database
      .select()
      .from(tokens)
      .where(and(eq(tokens.projectId, project.id), eq(tokens.isCurrent, true)))
      .limit(1)) ?? [];
  const repos = await database
    .select({
      privateOrMissing: githubRepositories.privateOrMissing,
    })
    .from(githubRepositories)
    .where(eq(githubRepositories.projectId, project.id));
  const snapshotMap = token ? await latestSnapshotsByTokenIds([token.id]) : new Map();
  const snapshot = token ? snapshotMap.get(token.id) ?? null : null;
  const input = copyInputFromRows({
    project,
    event,
    token: token ?? null,
    snapshot,
    hasPublicRepository: repos.some((repository) => !repository.privateOrMissing),
  });
  const fingerprint = explanationFingerprint(input);
  const cached = readCachedAiExplanation(event.metadata, fingerprint);
  if (cached) {
    return { eventId, ok: true, skipped: true, source: "cache" };
  }

  if (!isGeminiConfigured()) {
    // Keep template path on the feed; do not write a fake gemini cache.
    buildSignalCopy(input);
    return {
      eventId,
      ok: false,
      skipped: true,
      source: "template",
      error: "GEMINI_API_KEY is not set",
    };
  }

  const explained = await explainBuildSignalWithGemini(input);
  if (!explained.ok || explained.source !== "gemini") {
    return {
      eventId,
      ok: false,
      skipped: false,
      source: "template",
      error: explained.error ?? "Gemini explanation failed",
    };
  }

  const nextMetadata: Record<string, unknown> = {
    ...(event.metadata ?? {}),
    aiExplanation: {
      fingerprint: explained.fingerprint,
      model: explained.model,
      generatedAt: new Date().toISOString(),
      source: "gemini",
      copy: explained.copy,
    },
  };

  await database
    .update(events)
    .set({ metadata: nextMetadata, updatedAt: new Date() })
    .where(eq(events.id, event.id));

  return { eventId, ok: true, skipped: false, source: "gemini" };
}
