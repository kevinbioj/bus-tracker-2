DROP INDEX "vehicle_network_index";--> statement-breakpoint
CREATE INDEX "line_activity_updatedAt_index" ON "line_activity" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "network_idx" ON "line" USING btree ("network_id");--> statement-breakpoint
CREATE INDEX "vehicle_network_ref_index" ON "vehicle" USING btree ("network_id","ref");--> statement-breakpoint
CREATE INDEX "vehicle_network_index" ON "vehicle" USING btree ("network_id");