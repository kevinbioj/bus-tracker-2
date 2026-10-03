DROP INDEX "line_activity_line_indeex";--> statement-breakpoint
DROP INDEX "line_activity_vehicle_index";--> statement-breakpoint
DROP INDEX "line_activity_vehicle_line_updated_at_index";--> statement-breakpoint
DROP INDEX "vehicle_network_index";--> statement-breakpoint
CREATE INDEX "girouette_network_line_index" ON "girouette" USING btree ("network_id","line_id");--> statement-breakpoint
CREATE INDEX "line_activity_line_service_date_index" ON "line_activity" USING btree ("line_id","service_date");--> statement-breakpoint
CREATE INDEX "line_activity_vehicle_service_date_index" ON "line_activity" USING btree ("vehicle_id","service_date");--> statement-breakpoint
CREATE INDEX "line_activity_vehicle_line_started_at_index" ON "line_activity" USING btree ("vehicle_id","line_id","started_at");