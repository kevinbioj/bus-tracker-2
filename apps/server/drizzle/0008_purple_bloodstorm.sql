DROP INDEX "line_activity_updatedAt_index";--> statement-breakpoint
CREATE INDEX "line_activity_vehicle_service_date_index" ON "line_activity" USING btree ("vehicle_id","service_date");