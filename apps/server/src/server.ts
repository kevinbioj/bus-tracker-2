import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { createMiddleware } from "hono/factory";

export const hono = new Hono();

const DEFAULT_BODY_LIMIT = 16 * 1024;
const GIROUETTE_WRITE_PATH = /^\/(?:lines\/[^/]+\/girouettes|girouettes\/[^/]+)$/;

export const girouetteBodyLimit = bodyLimit({ maxSize: 1024 * 1024 });

export const allowedOrigins = [
	"https://bus-tracker.fr",
	"https://www.bus-tracker.fr",
	"https://dev.bus-tracker.fr",
	"http://localhost:3000",
	"http://localhost:4173",
];

/**
 * Journal des seules requêtes en erreur. Les clients rafraîchissent carte, courses et tableaux de
 * passages toutes les quelques secondes : une ligne par requête noierait le journal, pour un coût
 * d'écriture qui croît avec l'audience.
 */
hono.use(
	createMiddleware(async (c, next) => {
		const startedAt = performance.now();
		await next();
		if (c.res.status < 500) return;
		console.error(
			"✘ %s %s %d %dms",
			c.req.method,
			c.req.path,
			c.res.status,
			Math.round(performance.now() - startedAt),
			c.error ?? "",
		);
	}),
);

hono.use(
	cors({
		credentials: true,
		origin: allowedOrigins,
	}),
);

const defaultBodyLimit = bodyLimit({ maxSize: DEFAULT_BODY_LIMIT });

hono.use(
	createMiddleware((c, next) => {
		const isGirouetteWrite =
			(c.req.method === "POST" || c.req.method === "PUT") && GIROUETTE_WRITE_PATH.test(c.req.path);
		return isGirouetteWrite ? next() : defaultBodyLimit(c, next);
	}),
);
