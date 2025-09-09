import { eq } from "drizzle-orm";
import { Temporal } from "temporal-polyfill";
import * as z from "zod";

import { fetchLines } from "../cache/line-cache.js";
import { database } from "../database/database.js";
import { vehiclesTable } from "../database/schema.js";
import { createParamValidator, createQueryValidator } from "../helpers/validator-helpers.js";
import { findGirouette } from "../services/girouette-service.js";
import { journeyStore } from "../store/journey-store.js";

import { hono } from "../server.js";

const getVehicleJourneyMarkersQuery = z.object({
	swLat: z.coerce.number().min(-90).max(90),
	swLon: z.coerce.number().min(-180).max(180),
	neLat: z.coerce.number().min(-90).max(90),
	neLon: z.coerce.number().min(-180).max(180),
	includeMarker: z.string().optional(),
	excludeScheduled: z.coerce.boolean().optional(),
	includeIdfm: z.coerce.boolean().optional(),
});

hono.get("/vehicle-journeys/markers", createQueryValidator(getVehicleJourneyMarkersQuery), async (c) => {
	const { swLat, swLon, neLat, neLon, includeMarker, excludeScheduled, includeIdfm } = c.req.valid("query");

	const boundedJourneys = journeyStore
		.values()
		.filter(({ calls, position, networkId }) => {
			if (networkId === 71 && position.type !== "GPS" && !includeIdfm) return false;

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
		const additionalJourney = journeyStore.get(includeMarker);
		if (typeof additionalJourney !== "undefined") {
			boundedJourneys.push(additionalJourney);
		}
	}

	const lineIds = boundedJourneys.flatMap(({ lineId }) => lineId ?? []);
	const lines = await fetchLines(Array.from(new Set(lineIds)));

	const items = boundedJourneys.map(({ id, lineId, position }) => {
		const { latitude, longitude, bearing, type } = position;
		const line = lineId ? lines.get(lineId) : undefined;
		return {
			id,
			color: line?.textColor ? `#${line.textColor}` : undefined,
			fillColor: line?.color ? `#${line.color}` : undefined,
			position: { latitude, longitude, bearing, type },
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

	const journey = journeyStore.get(id);
	if (typeof journey === "undefined") {
		c.status(404);
		return c.json({ error: `No journey was found with id "${id}".` });
	}

	const vehicle = journey.vehicle?.id
		? (
				await database
					.select({ designation: vehiclesTable.designation })
					.from(vehiclesTable)
					.where(eq(vehiclesTable.id, journey.vehicle.id))
			).at(0)
		: undefined;

	const girouette = await findGirouette({
		networkId: journey.networkId,
		lineId: journey.lineId,
		directionId: journey.direction === "OUTBOUND" ? 0 : 1,
		destination: journey.destination ?? journey.calls?.findLast((call) => call.callStatus !== "SKIPPED")?.stopName,
	});

	return c.json({
		...journey,
		vehicle: journey.vehicle ? { ...journey.vehicle, designation: vehicle?.designation ?? undefined } : undefined,
		girouette: girouette?.data,
	});
});
