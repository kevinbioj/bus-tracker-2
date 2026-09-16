ALTER TABLE "region"
ALTER COLUMN "name" TYPE jsonb
USING jsonb_build_object('fr', "name");