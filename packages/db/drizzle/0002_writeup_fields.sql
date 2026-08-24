ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "writeup" text;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "whats_holding_back" text;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "what_to_watch" text;
