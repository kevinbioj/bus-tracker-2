DROP INDEX "line_activity_vehicle_updated_at_index";--> statement-breakpoint
CREATE INDEX "line_activity_vehicle_updated_at_desc_index" ON "line_activity" USING btree ("vehicle_id","updated_at" desc);