import { migrate } from "drizzle-orm/bun-sql/migrator";

import { database } from "./database.js";

export function migrateDatabase() {
	return migrate(database, {
		migrationsFolder: process.env.NODE_ENV === "production" ? "/bus-tracker/server/drizzle" : "./drizzle",
	});
}
