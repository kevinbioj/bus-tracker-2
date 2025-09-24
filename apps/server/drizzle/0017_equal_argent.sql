ALTER TABLE "editor" RENAME COLUMN "allowed_networks" TO "manageable_networks";--> statement-breakpoint
ALTER TABLE "editor" ADD COLUMN "discord_id" varchar;