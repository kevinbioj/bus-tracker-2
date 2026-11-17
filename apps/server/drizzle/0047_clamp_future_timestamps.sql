UPDATE "vehicle" SET "last_seen_at" = date_trunc('second', timezone('UTC', now())) WHERE "last_seen_at" > timezone('UTC', now());--> statement-breakpoint
UPDATE "line_activity" SET "started_at" = date_trunc('second', timezone('UTC', now())) WHERE "started_at" > timezone('UTC', now());--> statement-breakpoint
UPDATE "line_activity" SET "updated_at" = date_trunc('second', timezone('UTC', now())) WHERE "updated_at" > timezone('UTC', now());
