import { readFile } from "node:fs/promises";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema.js";

let connectionUrl = process.env.DATABASE_URL;
if (connectionUrl === undefined) {
	throw new Error('Expected "DATABASE_URL" environment to be defined!');
}

if (connectionUrl.includes("{PASSWORD_FILE}")) {
	const passwordFile = process.env.DATABASE_PASSWORD_FILE;
	if (passwordFile === undefined) {
		throw new Error('Connection URL refers to password file but no "DATABASE_PASSWORD_FILE" environment was defined!');
	}

	const password = (await readFile(passwordFile)).toString();
	connectionUrl = connectionUrl.replace("{PASSWORD_FILE}", password);
}

const connection = postgres(connectionUrl, {
	max: 25,
	idle_timeout: 120,
});

export const database = drizzle(connection, {
	casing: "snake_case",
	schema,
});
