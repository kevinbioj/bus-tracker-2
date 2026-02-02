import { readFile } from "node:fs/promises";
import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";

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

const connection = new SQL({
	idleTimeout: 60_000,
	max: 95,
	maxLifetime: 60_000,
	url: connectionUrl,
});

export const database = drizzle(connection, {
	casing: "snake_case",
	schema,
});
