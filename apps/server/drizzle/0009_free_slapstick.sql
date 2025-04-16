CREATE TABLE "region" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar2(255) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "network" ADD COLUMN "region_id" integer;--> statement-breakpoint
ALTER TABLE "network" ADD CONSTRAINT "network_region_id_region_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."region"("id") ON DELETE no action ON UPDATE no action;