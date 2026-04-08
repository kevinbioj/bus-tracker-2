import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

export const hono = new Hono();
hono.use(logger());
hono.use(
	cors({
		origin: [
			"https://bus-tracker.fr",
			"https://www.bus-tracker.fr",
			"https://dev.bus-tracker.fr",
			"http://localhost:3000",
			"http://localhost:4173",
		],
	}),
);
