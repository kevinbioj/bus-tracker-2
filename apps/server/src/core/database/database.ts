import { readFile } from "node:fs/promises";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema.js";

let PG_PASSWORD = process.env.PG_PASSWORD;

const PG_PASSWORD_FILE = process.env.PG_PASSWORD_FILE;
if (PG_PASSWORD_FILE !== undefined) {
	PG_PASSWORD = (await readFile(PG_PASSWORD_FILE, "utf-8")).trim();
}

const connection = postgres({
	host: process.env.PG_HOST,
	user: process.env.PG_USER,
	password: PG_PASSWORD,
	database: process.env.PG_DATABASE,
	path: process.env.PG_PATH,
	max: 25,
	idle_timeout: 120,
});

export const database = drizzle(connection, {
	casing: "snake_case",
	schema,
});
