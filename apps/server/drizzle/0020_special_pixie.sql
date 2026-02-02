CREATE INDEX "line_activity_updated_at_index" ON "line_activity" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "line_activity_vehicle_updated_at_index" ON "line_activity" USING btree ("vehicle_id","updated_at");--> statement-breakpoint
CREATE INDEX "line_activity_vehicle_service_date_started_at_index" ON "line_activity" USING btree ("vehicle_id","service_date","started_at");