-- Les index sont créés avant que les anciens ne soient supprimés, et seulement s'ils manquent : sur
-- une table `line_activity` volumineuse, mieux vaut les construire au préalable sans bloquer
-- l'application (scripts/prebuild-0042-indexes.sql, CREATE INDEX CONCURRENTLY), ce qu'une migration,
-- jouée dans une transaction, ne peut pas faire. Cette migration n'a alors plus rien de long à faire.
CREATE INDEX IF NOT EXISTS "girouette_network_line_index" ON "girouette" USING btree ("network_id","line_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "line_activity_line_service_date_index" ON "line_activity" USING btree ("line_id","service_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "line_activity_vehicle_service_date_index" ON "line_activity" USING btree ("vehicle_id","service_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "line_activity_vehicle_line_started_at_index" ON "line_activity" USING btree ("vehicle_id","line_id","started_at");--> statement-breakpoint
DROP INDEX IF EXISTS "line_activity_line_indeex";--> statement-breakpoint
DROP INDEX IF EXISTS "line_activity_vehicle_index";--> statement-breakpoint
DROP INDEX IF EXISTS "line_activity_vehicle_line_updated_at_index";--> statement-breakpoint
DROP INDEX IF EXISTS "vehicle_network_index";
