CREATE TABLE IF NOT EXISTS "girouette" (
	"id" serial PRIMARY KEY NOT NULL,
	"network_id" integer NOT NULL,
	"line_id" integer,
	"direction_id" smallint,
	"destinations" varchar[],
	"data" json NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "line_activity" (
	"id" serial PRIMARY KEY NOT NULL,
	"vehicle_id" integer NOT NULL,
	"line_id" integer NOT NULL,
	"service_date" date NOT NULL,
	"started_at" timestamp (0) NOT NULL,
	"updated_at" timestamp (0) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "line" (
	"id" serial PRIMARY KEY NOT NULL,
	"network_id" integer NOT NULL,
	"ref" varchar NOT NULL,
	"number" varchar NOT NULL,
	"cartridge_href" varchar,
	"color" char(6),
	"text_color" char(6),
	"archived_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mercato_activity" (
	"id" serial PRIMARY KEY NOT NULL,
	"vehicle_id" integer NOT NULL,
	"from_network_id" integer NOT NULL,
	"to_network_id" integer NOT NULL,
	"comment" text,
	"recorded_at" timestamp (0) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "network" (
	"id" serial PRIMARY KEY NOT NULL,
	"ref" varchar NOT NULL,
	"name" varchar NOT NULL,
	"authority" varchar,
	"logo_href" varchar,
	"color" char(6),
	"text_color" char(6),
	CONSTRAINT "network_ref_unique" UNIQUE("ref")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "operator" (
	"id" serial PRIMARY KEY NOT NULL,
	"network_id" integer NOT NULL,
	"ref" varchar NOT NULL,
	"name" varchar NOT NULL,
	"logo_href" varchar,
	CONSTRAINT "operator_ref_unique" UNIQUE("ref")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vehicle" (
	"id" serial PRIMARY KEY NOT NULL,
	"network_id" integer NOT NULL,
	"operator_id" integer,
	"ref" varchar NOT NULL,
	"number" varchar NOT NULL,
	"designation" varchar,
	"tc_id" integer,
	"last_seen_at" timestamp (0),
	"archived_at" timestamp (0)
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "girouette" ADD CONSTRAINT "girouette_network_id_network_id_fk" FOREIGN KEY ("network_id") REFERENCES "public"."network"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "girouette" ADD CONSTRAINT "girouette_line_id_line_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."line"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "line_activity" ADD CONSTRAINT "line_activity_vehicle_id_vehicle_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicle"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "line_activity" ADD CONSTRAINT "line_activity_line_id_line_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."line"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "line" ADD CONSTRAINT "line_network_id_network_id_fk" FOREIGN KEY ("network_id") REFERENCES "public"."network"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mercato_activity" ADD CONSTRAINT "mercato_activity_vehicle_id_vehicle_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicle"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mercato_activity" ADD CONSTRAINT "mercato_activity_from_network_id_network_id_fk" FOREIGN KEY ("from_network_id") REFERENCES "public"."network"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mercato_activity" ADD CONSTRAINT "mercato_activity_to_network_id_network_id_fk" FOREIGN KEY ("to_network_id") REFERENCES "public"."network"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "operator" ADD CONSTRAINT "operator_network_id_network_id_fk" FOREIGN KEY ("network_id") REFERENCES "public"."network"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vehicle" ADD CONSTRAINT "vehicle_network_id_network_id_fk" FOREIGN KEY ("network_id") REFERENCES "public"."network"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vehicle" ADD CONSTRAINT "vehicle_operator_id_operator_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operator"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "line_activity_vehicle_index" ON "line_activity" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mercato_activity_vehicle_index" ON "mercato_activity" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vehicle_network_index" ON "vehicle" USING btree ("operator_id");