import type { Hono } from "hono";
import { Temporal } from "temporal-polyfill";
import * as z from "zod";

import { createQueryValidator } from "../helpers/validator-helpers.js";
import type { JourneyStore } from "../store/journey-store.js";

const getVehicleJourneysQuerySchema = z.object({
	swLat: z.coerce.number().min(-90).max(90),
	swLon: z.coerce.number().min(-180).max(180),
	neLat: z.coerce.number().min(-90).max(90),
	neLon: z.coerce.number().min(-180).max(180),
	withCalls: z.enum(["true", "false"]).default("true"),
});

export const registerVehicleJourneyRoutes = (hono: Hono, store: JourneyStore) =>
	hono.get("/vehicle-journeys", createQueryValidator(getVehicleJourneysQuerySchema), async (c) => {
		const { swLat, swLon, neLat, neLon, withCalls } = c.req.valid("query");

		const journeys = store
			.values()
			.filter((journey) => {
				const { latitude, longitude } = journey.position;
				return swLat <= latitude && latitude <= neLat && swLon <= longitude && longitude <= neLon;
			})
			.toArray();

		return c.json({
			journeys: !withCalls ? journeys.map(({ calls, ...journey }) => journey) : journeys,
			generatedAt: Temporal.Now.instant(),
		});
	});
