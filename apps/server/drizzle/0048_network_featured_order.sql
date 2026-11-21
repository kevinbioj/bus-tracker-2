ALTER TABLE "network" ADD COLUMN "featured_order" integer;--> statement-breakpoint
UPDATE "network" SET "featured_order" = "featured"."order"
FROM (VALUES
	('TCL', 1),
	('RTM', 2),
	('ASTUCE', 3),
	('STAS', 4),
	('TAM', 5),
	('TISSEO', 6),
	('TWISTO', 7),
	('TBM', 8),
	('STAR', 9),
	('DKBUS', 10)
) AS "featured"("ref", "order")
WHERE "network"."ref" = "featured"."ref";
