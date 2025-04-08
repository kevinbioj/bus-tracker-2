ALTER TABLE "region" ADD COLUMN "sort_order" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "region" ADD CONSTRAINT "region_sort_order_unique" UNIQUE("sort_order");