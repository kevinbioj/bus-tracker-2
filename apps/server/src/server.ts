import { Hono } from "hono";
import { cors } from "hono/cors";
import { createMiddleware } from "hono/factory";

export const hono = new Hono();

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
		origin: [
			"https://bus-tracker.fr",
			"https://www.bus-tracker.fr",
			"https://dev.bus-tracker.fr",
			"http://localhost:3000",
			"http://localhost:4173",
		],
	}),
);
