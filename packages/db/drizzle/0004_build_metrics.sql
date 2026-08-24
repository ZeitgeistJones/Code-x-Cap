ALTER TABLE "activity_signals" ADD COLUMN IF NOT EXISTS "metrics" jsonb;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "adoption_metrics" jsonb;
