CREATE TABLE "data_source" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" varchar(32) NOT NULL,
	"provider_id" varchar NOT NULL,
	"source_id" varchar NOT NULL,
	"network_refs" varchar[] NOT NULL,
	"static_feed" jsonb NOT NULL,
	"realtime_feeds" jsonb NOT NULL,
	"authenticated" boolean DEFAULT false NOT NULL,
	"first_seen_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "data_source_provider_source_unique_index" ON "data_source" USING btree ("provider_id","source_id");--> statement-breakpoint
CREATE INDEX "data_source_network_refs_gin_index" ON "data_source" USING gin ("network_refs");