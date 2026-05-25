CREATE TABLE "vehicle_report" (
	"id" serial PRIMARY KEY NOT NULL,
	"vehicle_id" integer NOT NULL,
	"field" varchar(64) NOT NULL,
	"value" varchar(64) NOT NULL,
	"reporter_hash" varchar(64) NOT NULL,
	"status" varchar(32) DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"applied_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "edition_log" ALTER COLUMN "editor_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "vehicle_report" ADD CONSTRAINT "vehicle_report_vehicle_id_vehicle_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vehicle_report_vehicle_field_status_index" ON "vehicle_report" USING btree ("vehicle_id","field","status");--> statement-breakpoint
CREATE INDEX "vehicle_report_reporter_index" ON "vehicle_report" USING btree ("reporter_hash");