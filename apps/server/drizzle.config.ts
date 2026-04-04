import { defineConfig } from "drizzle-kit";

export default defineConfig({
	out: "./drizzle",
	schema: "./src/core/database/schema.ts",
	dialect: "postgresql",
});
