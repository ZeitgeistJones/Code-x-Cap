CREATE TABLE IF NOT EXISTS "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"short_description" text,
	"long_description" text,
	"project_status" text DEFAULT 'candidate' NOT NULL,
	"primary_category" text,
	"website_url" text,
	"twitter_url" text,
	"logo_url" text,
	"primary_chain" text,
	"primary_chain_id" integer,
	"identity_confidence" integer DEFAULT 0,
	"first_discovered_at" timestamp with time zone DEFAULT now(),
	"last_reviewed_at" timestamp with time zone,
	"next_check_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"group" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_tags" (
	"project_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "project_tags_project_id_tag_id_pk" PRIMARY KEY("project_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"symbol" text,
	"name" text,
	"chain" text NOT NULL,
	"chain_id" integer NOT NULL,
	"contract_address" text,
	"contract_verified" boolean DEFAULT false,
	"token_status" text DEFAULT 'unknown' NOT NULL,
	"token_role" text DEFAULT 'primary' NOT NULL,
	"decimals" integer,
	"total_supply" text,
	"circulating_supply" text,
	"deployment_date" timestamp with time zone,
	"migration_target_token_id" uuid,
	"is_current" boolean DEFAULT true NOT NULL,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "github_repositories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"owner" text NOT NULL,
	"repo" text NOT NULL,
	"url" text NOT NULL,
	"repo_role" text DEFAULT 'core' NOT NULL,
	"default_branch" text DEFAULT 'main',
	"stars" integer DEFAULT 0,
	"forks" integer DEFAULT 0,
	"open_issues" integer DEFAULT 0,
	"latest_commit_at" timestamp with time zone,
	"latest_meaningful_commit_at" timestamp with time zone,
	"last_checked_at" timestamp with time zone,
	"archived" boolean DEFAULT false,
	"private_or_missing" boolean DEFAULT false,
	"identity_verified" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "github_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repository_id" uuid NOT NULL,
	"commit_sha" text NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"author" text,
	"title" text,
	"files_changed" integer,
	"additions" integer,
	"deletions" integer,
	"changed_paths" jsonb,
	"classification" text DEFAULT 'unknown',
	"meaningful_score" real,
	"classification_reason" text,
	"source_url" text,
	"human_override" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "market_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_id" uuid NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"price_usd" numeric(36, 18),
	"market_cap" numeric(36, 2),
	"fdv" numeric(36, 2),
	"liquidity_usd" numeric(36, 2),
	"volume_24h" numeric(36, 2),
	"buys_24h" integer,
	"sells_24h" integer,
	"holder_count" integer,
	"source" text NOT NULL,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"claim_field" text NOT NULL,
	"claim_value" text NOT NULL,
	"source_url" text NOT NULL,
	"provider" text,
	"confidence" integer DEFAULT 5,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"body" text NOT NULL,
	"author" text DEFAULT 'admin',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"severity" text DEFAULT 'info' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"source_url" text,
	"metadata" jsonb,
	"auto_generated" boolean DEFAULT false NOT NULL,
	"confirmed" boolean DEFAULT true NOT NULL,
	"dedupe_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "activity_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"signal_type" text NOT NULL,
	"latest_at" timestamp with time zone,
	"source" text,
	"confidence" integer DEFAULT 5,
	"summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "research_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"dimension" text NOT NULL,
	"score" integer NOT NULL,
	"explanation" text,
	"evidence_source" text,
	"is_manual" boolean DEFAULT true NOT NULL,
	"scored_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "watchlist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_name" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"error" text,
	"records_processed" integer DEFAULT 0,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"metric_key" text NOT NULL,
	"metric_value" numeric(36, 6),
	"unit" text,
	"source" text,
	"source_url" text,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"alert_type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"severity" text DEFAULT 'info',
	"delivered_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "alert_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"alert_type" text NOT NULL,
	"channel" text DEFAULT 'in_app' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_tags" ADD CONSTRAINT "project_tags_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "project_tags" ADD CONSTRAINT "project_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "github_repositories" ADD CONSTRAINT "github_repositories_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "github_activities" ADD CONSTRAINT "github_activities_repository_id_github_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."github_repositories"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "market_snapshots" ADD CONSTRAINT "market_snapshots_token_id_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."tokens"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "activity_signals" ADD CONSTRAINT "activity_signals_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "research_scores" ADD CONSTRAINT "research_scores_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD CONSTRAINT "watchlist_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "project_usage" ADD CONSTRAINT "project_usage_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "alert_subscriptions" ADD CONSTRAINT "alert_subscriptions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "projects_slug_uidx" ON "projects" USING btree ("slug");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tags_slug_uidx" ON "tags" USING btree ("slug");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tokens_project_idx" ON "tokens" USING btree ("project_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tokens_chain_contract_uidx" ON "tokens" USING btree ("chain_id","contract_address");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "github_repos_project_idx" ON "github_repositories" USING btree ("project_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "github_repos_owner_repo_uidx" ON "github_repositories" USING btree ("owner","repo");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "github_activities_repo_idx" ON "github_activities" USING btree ("repository_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "github_activities_sha_uidx" ON "github_activities" USING btree ("repository_id","commit_sha");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "market_snapshots_token_ts_idx" ON "market_snapshots" USING btree ("token_id","timestamp");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "evidence_project_idx" ON "evidence" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notes_project_idx" ON "notes" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_project_ts_idx" ON "events" USING btree ("project_id","timestamp");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "events_dedupe_uidx" ON "events" USING btree ("project_id","dedupe_key");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "activity_signals_project_type_uidx" ON "activity_signals" USING btree ("project_id","signal_type");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "research_scores_project_dim_uidx" ON "research_scores" USING btree ("project_id","dimension");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "watchlist_project_uidx" ON "watchlist_items" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_runs_name_started_idx" ON "job_runs" USING btree ("job_name","started_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_usage_project_idx" ON "project_usage" USING btree ("project_id");
