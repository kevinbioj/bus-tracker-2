import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema.js";

const connection = postgres(process.env.DATABASE_URL!);

export const database = drizzle(connection, {
	casing: "snake_case",
	schema,
});
