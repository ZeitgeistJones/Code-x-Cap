ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "discovery_tier" text DEFAULT 'under_the_radar' NOT NULL;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "tracking_reason" text;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "research_context" text;
