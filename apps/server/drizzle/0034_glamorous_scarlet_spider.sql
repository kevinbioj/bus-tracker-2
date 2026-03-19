DROP INDEX IF EXISTS "line_activity_line_service_date_index";--> statement-breakpoint
DROP INDEX IF EXISTS "line_activity_vehicle_updated_at_desc_index";--> statement-breakpoint
DROP INDEX IF EXISTS "line_activity_vehicle_line_updated_at_desc_index";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "line_activity_vehicle_line_updated_at_index" ON "line_activity" USING btree ("vehicle_id","line_id","updated_at");