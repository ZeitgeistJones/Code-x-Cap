ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "build_visibility" text DEFAULT 'unknown' NOT NULL;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "research_priority" text DEFAULT 'medium' NOT NULL;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "research_question" text;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "what_would_change_thesis" text;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "adoption_confidence" integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "activity_origin" text DEFAULT 'unknown' NOT NULL;
--> statement-breakpoint
ALTER TABLE "activity_signals" ADD COLUMN IF NOT EXISTS "activity_origin" text DEFAULT 'unknown' NOT NULL;
