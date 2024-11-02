import type { Hono } from "hono";
import { Temporal } from "temporal-polyfill";
import * as z from "zod";

import { createQueryValidator } from "../helpers/validator-helpers.js";
import type { JourneyStore } from "../store/journey-store.js";

const getVehicleJourneysQuerySchema = z.object({
	latitude: z.coerce
		.number()
		.min(-90, "Latitude must be within range [-90; 90]")
		.max(90, "Latitude must be within range [-90; 90]"),
	longitude: z.coerce
		.number()
		.min(-180, "Latitude must be within range [-180; 180]")
		.max(180, "Latitude must be within range [-180; 180]"),
	zoom: z.coerce.number(),
});

export const registerVehicleJourneyRoutes = (hono: Hono, store: JourneyStore) =>
	hono.get(
		"/vehicle-journeys",
		/*createQueryValidator(getVehicleJourneysQuerySchema),*/ (c) => {
			const journeys = store.values().toArray();

			return c.json({
				journeys: journeys,
				generatedAt: Temporal.Now.instant(),
			});
		},
	);
