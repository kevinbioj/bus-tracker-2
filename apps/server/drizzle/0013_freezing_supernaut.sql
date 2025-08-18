CREATE TABLE "edition_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"editor_id" integer NOT NULL,
	"network_id" integer NOT NULL,
	"line_id" integer,
	"vehicle_id" integer,
	"updated_fields" json NOT NULL,
	"recorded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "editor" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar NOT NULL,
	"token" varchar NOT NULL,
	"enabled" boolean DEFAULT true,
	"allowed_networks" json DEFAULT '[]'::json NOT NULL,
	"last_seen_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "editor_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "edition_log" ADD CONSTRAINT "edition_log_editor_id_editor_id_fk" FOREIGN KEY ("editor_id") REFERENCES "public"."editor"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edition_log" ADD CONSTRAINT "edition_log_network_id_network_id_fk" FOREIGN KEY ("network_id") REFERENCES "public"."network"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edition_log" ADD CONSTRAINT "edition_log_line_id_line_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."line"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edition_log" ADD CONSTRAINT "edition_log_vehicle_id_vehicle_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicle"("id") ON DELETE no action ON UPDATE no action;