import { readFile } from "node:fs/promises";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema.js";

let connectionUrl = process.env.DATABASE_URL;
if (typeof connectionUrl === "undefined") {
	throw new Error('Expected "DATABASE_URL" environment to be defined!');
}

if (connectionUrl.includes("{PASSWORD_FILE}")) {
	const passwordFile = process.env.DATABASE_PASSWORD_FILE;
	if (typeof passwordFile === "undefined") {
		throw new Error('Connection URL refers to password file but no "DATABASE_PASSWORD_FILE" environment was defined!');
	}

	const password = (await readFile(passwordFile)).toString();
	connectionUrl = connectionUrl.replace("{PASSWORD_FILE}", password);
}

const connection = postgres(connectionUrl, {
	max: 95,
	max_lifetime: 60_000,
	idle_timeout: 60_000,
});

export const database = drizzle(connection, {
	casing: "snake_case",
	schema,
});
