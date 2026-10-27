CREATE TABLE "line_destination" (
	"line_id" integer NOT NULL,
	"destination" varchar NOT NULL,
	"last_seen_at" timestamp (0) NOT NULL,
	CONSTRAINT "line_destination_line_id_destination_pk" PRIMARY KEY("line_id","destination")
);
--> statement-breakpoint
ALTER TABLE "line_destination" ADD CONSTRAINT "line_destination_line_id_line_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."line"("id") ON DELETE no action ON UPDATE no action;