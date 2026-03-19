DROP INDEX IF EXISTS "vehicle_network_ref_index";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "line_activity_line_service_date_index" ON "line_activity" USING btree ("line_id","service_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "line_ref_gin_idx" ON "line" USING gin ("ref");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "vehicle_network_ref_unique_index" ON "vehicle" USING btree ("network_id","ref");