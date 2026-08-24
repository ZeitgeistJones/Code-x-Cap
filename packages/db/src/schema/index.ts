/**
 * Drizzle schema — project-centric relational model.
 * History is append-only for tokens/snapshots/events; never overwrite contracts.
 */

import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    shortDescription: text("short_description"),
    longDescription: text("long_description"),
    projectStatus: text("project_status").notNull().default("candidate"),
    /** Separate from status: under_the_radar | niche_known | established | benchmark */
    discoveryTier: text("discovery_tier").notNull().default("under_the_radar"),
    trackingReason: text("tracking_reason"),
    researchContext: text("research_context"),
    writeup: text("writeup"),
    whatsHoldingBack: text("whats_holding_back"),
    whatToWatch: text("what_to_watch"),
    /** How inspectable is current development: open_current | open_stale | public_snapshot_private_current | … */
    buildVisibility: text("build_visibility").notNull().default("unknown"),
    /** Manual research lane: very_high | high | medium | low | special_situation */
    researchPriority: text("research_priority").notNull().default("medium"),
    /** Biggest unresolved research question for this project */
    researchQuestion: text("research_question"),
    /** What evidence would change the current thesis */
    whatWouldChangeThesis: text("what_would_change_thesis"),
    /**
     * Confidence that meaningful *external* adoption exists (0–10).
     * Separate from product_reality — a live product can still have zero external users.
     */
    adoptionConfidence: integer("adoption_confidence").default(0),
    /**
     * Default framing for usage/onchain metrics on this project:
     * external_verified | mixed | project_operated | unknown
     */
    activityOrigin: text("activity_origin").notNull().default("unknown"),
    /**
     * Future adoption signals (all nullable). Do not invent values.
     * Shape: activeUsers, payingUsers, uniqueX402Payers, apiCalls,
     * x402PaymentVolume, packageDownloads, externalIntegrations, externalContributors
     */
    adoptionMetrics: jsonb("adoption_metrics").$type<Record<string, number | string | null>>(),
    primaryCategory: text("primary_category"),
    websiteUrl: text("website_url"),
    twitterUrl: text("twitter_url"),
    logoUrl: text("logo_url"),
    primaryChain: text("primary_chain"),
    primaryChainId: integer("primary_chain_id"),
    identityConfidence: integer("identity_confidence").default(0),
    firstDiscoveredAt: timestamp("first_discovered_at", { withTimezone: true }).defaultNow(),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    nextCheckAt: timestamp("next_check_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("projects_slug_uidx").on(t.slug)],
);

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    group: text("group").notNull(),
    description: text("description"),
    ...timestamps,
  },
  (t) => [uniqueIndex("tags_slug_uidx").on(t.slug)],
);

export const projectTags = pgTable(
  "project_tags",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.tagId] })],
);

export const tokens = pgTable(
  "tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    symbol: text("symbol"),
    name: text("name"),
    chain: text("chain").notNull(),
    chainId: integer("chain_id").notNull(),
    contractAddress: text("contract_address"),
    contractVerified: boolean("contract_verified").default(false),
    tokenStatus: text("token_status").notNull().default("unknown"),
    tokenRole: text("token_role").notNull().default("primary"),
    decimals: integer("decimals"),
    totalSupply: text("total_supply"),
    circulatingSupply: text("circulating_supply"),
    deploymentDate: timestamp("deployment_date", { withTimezone: true }),
    migrationTargetTokenId: uuid("migration_target_token_id"),
    isCurrent: boolean("is_current").notNull().default(true),
    sourceUrl: text("source_url"),
    ...timestamps,
  },
  (t) => [
    index("tokens_project_idx").on(t.projectId),
    uniqueIndex("tokens_chain_contract_uidx").on(t.chainId, t.contractAddress),
  ],
);

export const githubRepositories = pgTable(
  "github_repositories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    owner: text("owner").notNull(),
    repo: text("repo").notNull(),
    url: text("url").notNull(),
    repoRole: text("repo_role").notNull().default("core"),
    defaultBranch: text("default_branch").default("main"),
    stars: integer("stars").default(0),
    forks: integer("forks").default(0),
    openIssues: integer("open_issues").default(0),
    latestCommitAt: timestamp("latest_commit_at", { withTimezone: true }),
    latestMeaningfulCommitAt: timestamp("latest_meaningful_commit_at", { withTimezone: true }),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    archived: boolean("archived").default(false),
    privateOrMissing: boolean("private_or_missing").default(false),
    identityVerified: boolean("identity_verified").default(false),
    ...timestamps,
  },
  (t) => [
    index("github_repos_project_idx").on(t.projectId),
    uniqueIndex("github_repos_owner_repo_uidx").on(t.owner, t.repo),
  ],
);

export const githubActivities = pgTable(
  "github_activities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    repositoryId: uuid("repository_id")
      .notNull()
      .references(() => githubRepositories.id, { onDelete: "cascade" }),
    commitSha: text("commit_sha").notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    author: text("author"),
    title: text("title"),
    filesChanged: integer("files_changed"),
    additions: integer("additions"),
    deletions: integer("deletions"),
    changedPaths: jsonb("changed_paths").$type<string[]>(),
    classification: text("classification").default("unknown"),
    meaningfulScore: real("meaningful_score"),
    classificationReason: text("classification_reason"),
    sourceUrl: text("source_url"),
    humanOverride: boolean("human_override").default(false),
    ...timestamps,
  },
  (t) => [
    index("github_activities_repo_idx").on(t.repositoryId),
    uniqueIndex("github_activities_sha_uidx").on(t.repositoryId, t.commitSha),
  ],
);

export const marketSnapshots = pgTable(
  "market_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tokenId: uuid("token_id")
      .notNull()
      .references(() => tokens.id, { onDelete: "cascade" }),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
    priceUsd: numeric("price_usd", { precision: 36, scale: 18 }),
    marketCap: numeric("market_cap", { precision: 36, scale: 2 }),
    fdv: numeric("fdv", { precision: 36, scale: 2 }),
    liquidityUsd: numeric("liquidity_usd", { precision: 36, scale: 2 }),
    volume24h: numeric("volume_24h", { precision: 36, scale: 2 }),
    buys24h: integer("buys_24h"),
    sells24h: integer("sells_24h"),
    holderCount: integer("holder_count"),
    source: text("source").notNull(),
    sourceUrl: text("source_url"),
    ...timestamps,
  },
  (t) => [index("market_snapshots_token_ts_idx").on(t.tokenId, t.timestamp)],
);

export const evidence = pgTable(
  "evidence",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    claimField: text("claim_field").notNull(),
    claimValue: text("claim_value").notNull(),
    sourceUrl: text("source_url").notNull(),
    provider: text("provider"),
    confidence: integer("confidence").default(5),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("evidence_project_idx").on(t.projectId)],
);

export const notes = pgTable(
  "notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    author: text("author").default("admin"),
    ...timestamps,
  },
  (t) => [index("notes_project_idx").on(t.projectId)],
);

export const events = pgTable(
  "events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
    severity: text("severity").notNull().default("info"),
    title: text("title").notNull(),
    description: text("description"),
    sourceUrl: text("source_url"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    autoGenerated: boolean("auto_generated").notNull().default(false),
    confirmed: boolean("confirmed").notNull().default(true),
    dedupeKey: text("dedupe_key"),
    ...timestamps,
  },
  (t) => [
    index("events_project_ts_idx").on(t.projectId, t.timestamp),
    uniqueIndex("events_dedupe_uidx").on(t.projectId, t.dedupeKey),
  ],
);

export const activitySignals = pgTable(
  "activity_signals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    signalType: text("signal_type").notNull(),
    latestAt: timestamp("latest_at", { withTimezone: true }),
    source: text("source"),
    confidence: integer("confidence").default(5),
    summary: text("summary"),
    /** Who generated this signal: external_verified | mixed | project_operated | unknown */
    activityOrigin: text("activity_origin").notNull().default("unknown"),
    /**
     * Structured code metrics when signal_type=code:
     * { meaningful7, meaningful30, total7, total30, daysSinceMeaningful,
     *   filesChanged30?, additions30?, deletions30? }
     */
    metrics: jsonb("metrics").$type<Record<string, number | null>>(),
    ...timestamps,
  },
  (t) => [uniqueIndex("activity_signals_project_type_uidx").on(t.projectId, t.signalType)],
);

export const researchScores = pgTable(
  "research_scores",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    dimension: text("dimension").notNull(),
    score: integer("score").notNull(),
    explanation: text("explanation"),
    evidenceSource: text("evidence_source"),
    isManual: boolean("is_manual").notNull().default(true),
    scoredAt: timestamp("scored_at", { withTimezone: true }).defaultNow().notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("research_scores_project_dim_uidx").on(t.projectId, t.dimension)],
);

export const watchlistItems = pgTable(
  "watchlist_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    note: text("note"),
    ...timestamps,
  },
  (t) => [uniqueIndex("watchlist_project_uidx").on(t.projectId)],
);

export const jobRuns = pgTable(
  "job_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobName: text("job_name").notNull(),
    status: text("status").notNull().default("running"),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    error: text("error"),
    recordsProcessed: integer("records_processed").default(0),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  },
  (t) => [index("job_runs_name_started_idx").on(t.jobName, t.startedAt)],
);

export const projectUsage = pgTable(
  "project_usage",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    metricKey: text("metric_key").notNull(),
    metricValue: numeric("metric_value", { precision: 36, scale: 6 }),
    unit: text("unit"),
    source: text("source"),
    sourceUrl: text("source_url"),
    observedAt: timestamp("observed_at", { withTimezone: true }).defaultNow().notNull(),
    ...timestamps,
  },
  (t) => [index("project_usage_project_idx").on(t.projectId)],
);

export const alerts = pgTable("alerts", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  alertType: text("alert_type").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  severity: text("severity").default("info"),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  readAt: timestamp("read_at", { withTimezone: true }),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  ...timestamps,
});

export const alertSubscriptions = pgTable("alert_subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  alertType: text("alert_type").notNull(),
  channel: text("channel").notNull().default("in_app"),
  enabled: boolean("enabled").notNull().default(true),
  ...timestamps,
});

/* Relations */

export const projectsRelations = relations(projects, ({ many }) => ({
  tokens: many(tokens),
  repositories: many(githubRepositories),
  tags: many(projectTags),
  evidence: many(evidence),
  notes: many(notes),
  events: many(events),
  activitySignals: many(activitySignals),
  researchScores: many(researchScores),
  watchlistItems: many(watchlistItems),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  projects: many(projectTags),
}));

export const projectTagsRelations = relations(projectTags, ({ one }) => ({
  project: one(projects, { fields: [projectTags.projectId], references: [projects.id] }),
  tag: one(tags, { fields: [projectTags.tagId], references: [tags.id] }),
}));

export const tokensRelations = relations(tokens, ({ one, many }) => ({
  project: one(projects, { fields: [tokens.projectId], references: [projects.id] }),
  snapshots: many(marketSnapshots),
}));

export const githubRepositoriesRelations = relations(githubRepositories, ({ one, many }) => ({
  project: one(projects, { fields: [githubRepositories.projectId], references: [projects.id] }),
  activities: many(githubActivities),
}));

export const githubActivitiesRelations = relations(githubActivities, ({ one }) => ({
  repository: one(githubRepositories, {
    fields: [githubActivities.repositoryId],
    references: [githubRepositories.id],
  }),
}));

export const marketSnapshotsRelations = relations(marketSnapshots, ({ one }) => ({
  token: one(tokens, { fields: [marketSnapshots.tokenId], references: [tokens.id] }),
}));
