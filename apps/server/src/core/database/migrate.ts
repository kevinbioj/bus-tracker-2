import { migrate } from "drizzle-orm/postgres-js/migrator";

import { database } from "./database.js";

export function migrateDatabase() {
	return migrate(database, {
		migrationsFolder: process.env.NODE_ENV === "production" ? "/bus-tracker/server/drizzle" : "./drizzle",
	});
}
