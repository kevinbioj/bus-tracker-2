import { defineConfig } from "drizzle-kit";

if (typeof process.env.DATABASE_URL !== "string") {
	throw new Error("Expected environment variable 'DATABASE_URL' to be set!");
}

export default defineConfig({
	out: "./drizzle",
	schema: "./src/database/schema.ts",
	dialect: "postgresql",
	dbCredentials: {
		url: process.env.DATABASE_URL,
	},
});
