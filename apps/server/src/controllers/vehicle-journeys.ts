import { inArray } from "drizzle-orm";
import type { Hono } from "hono";
import { Temporal } from "temporal-polyfill";
import * as z from "zod";

import { database } from "../database/database.js";
import { type Line, lines } from "../database/schema.js";
import { createParamValidator, createQueryValidator } from "../helpers/validator-helpers.js";
import type { JourneyStore } from "../store/journey-store.js";

export const registerVehicleJourneyRoutes = (hono: Hono, store: JourneyStore) => {
	const getVehicleJourneyMarkersQuery = z.object({
		swLat: z.coerce.number().min(-90).max(90),
		swLon: z.coerce.number().min(-180).max(180),
		neLat: z.coerce.number().min(-90).max(90),
		neLon: z.coerce.number().min(-180).max(180),
		includeMarker: z.string().optional(),
		excludeScheduled: z.coerce.boolean().optional(),
	});

	hono.get("/vehicle-journeys/markers", createQueryValidator(getVehicleJourneyMarkersQuery), async (c) => {
		const { swLat, swLon, neLat, neLon, includeMarker, excludeScheduled } = c.req.valid("query");

		const boundedJourneys = store
			.values()
			.filter(({ calls, position }) => {
				if (
					excludeScheduled &&
					position.type === "COMPUTED" &&
					calls?.every((call) => typeof call.expectedTime === "undefined")
				)
					return false;

				const { latitude, longitude } = position;
				return swLat <= latitude && latitude <= neLat && swLon <= longitude && longitude <= neLon;
			})
			.toArray();

		if (typeof includeMarker !== "undefined" && !boundedJourneys.some((journey) => journey.id === includeMarker)) {
			const additionalJourney = store.get(includeMarker);
			if (typeof additionalJourney !== "undefined") {
				boundedJourneys.push(additionalJourney);
			}
		}

		const lineIds = boundedJourneys.reduce((set, { lineId }) => (lineId ? set.add(lineId) : set), new Set<number>());
		const lineMap = (
			await database
				.select()
				.from(lines)
				.where(inArray(lines.id, Array.from(lineIds)))
		).reduce((map, line) => map.set(line.id, line), new Map<number, Line>());

		const items = boundedJourneys.map(({ id, lineId, position }) => {
			const { latitude, longitude, type } = position;
			const line = lineId ? lineMap.get(lineId) : undefined;
			return {
				id,
				color: line?.textColor ? `#${line.textColor}` : undefined,
				fillColor: line?.color ? `#${line.color}` : undefined,
				position: { latitude, longitude, type },
			};
		});

		return c.json({
			items,
			at: Temporal.Now.instant(),
		});
	});

	const getVehicleJourneyParams = z.object({
		id: z.string(),
	});

	hono.get("/vehicle-journeys/:id", createParamValidator(getVehicleJourneyParams), async (c) => {
		const { id } = c.req.valid("param");

		const journey = store.get(id);
		if (typeof journey === "undefined") {
			c.status(404);
			return c.json({ error: `No journey was found with id "${id}".` });
		}

		return c.json(journey);
	});
};
