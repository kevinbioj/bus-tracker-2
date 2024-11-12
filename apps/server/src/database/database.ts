import { readFile } from "node:fs/promises";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema.js";

let connectionUrl = process.env.DATABASE_URL ?? "postgresql://bustracker:bustracker@localhost:5432/bustracker";

if (typeof process.env.DATABASE_URL_FILE !== "undefined") {
	const connectionUrlFile = await readFile(process.env.DATABASE_URL_FILE);
	connectionUrl = connectionUrlFile.toString();
}

const connection = postgres(connectionUrl);

export const database = drizzle(connection, {
	casing: "snake_case",
	schema,
});
