import { inArray } from "drizzle-orm";
import * as z from "zod";

import { database } from "../core/database/database.js";
import { linesTable } from "../core/database/schema.js";
import { findJourneyAlerts } from "../core/services/service-alert-service.js";
import { buildJourneyDetails } from "../core/services/vehicle-journey-details.js";
import { type MarkersFilter, matchesMarkersFilter, toMarker } from "../core/services/vehicle-journey-markers.js";
import { loadJourneyPaths } from "../core/services/vehicle-journey-paths.js";
import { journeyStore } from "../core/store/journey-store.js";
import { redis } from "../index.js";
import { hono } from "../server.js";
import { keyBy } from "../utils/key-by.js";
import { createParamValidator, createQueryValidator } from "../utils/validator-helpers.js";

const getVehicleJourneyMarkersQuery = z.object({
	swLat: z.coerce.number().min(-90).max(90),
	swLon: z.coerce.number().min(-180).max(180),
	neLat: z.coerce.number().min(-90).max(90),
	neLon: z.coerce.number().min(-180).max(180),
	includeMarker: z.string().optional(),
	excludeScheduled: z.coerce.boolean().optional(),
	// Absent = aucun filtrage pays, pour rester compatible avec les clients existants.
	countryCodes: z
		.string()
		.optional()
		.transform((value) => (value !== undefined ? value.split(",").filter((code) => code.length > 0) : undefined))
		.transform((codes) => (codes !== undefined && codes.length > 0 ? new Set(codes) : undefined)),
	positionTypes: z
		.string()
		.optional()
		.transform((value) => (value !== undefined ? value.split(",") : undefined))
		.pipe(z.array(z.enum(["GPS", "ESTIMATED", "SCHEDULED"])).optional()),
	networkId: z
		.union([z.coerce.number(), z.array(z.coerce.number())])
		.optional()
		.transform((values) => (typeof values === "number" ? [values] : values)),
	lineId: z
		.union([z.coerce.number(), z.array(z.coerce.number())])
		.optional()
		.transform((values) => (typeof values === "number" ? [values] : values)),
});

hono.get("/vehicle-journeys/markers", createQueryValidator(getVehicleJourneyMarkersQuery), async (c) => {
	const {
		swLat,
		swLon,
		neLat,
		neLon,
		includeMarker,
		excludeScheduled,
		positionTypes,
		lineId,
		networkId,
		countryCodes,
	} = c.req.valid("query");

	const filter: MarkersFilter = {
		swLat,
		swLon,
		neLat,
		neLon,
		networkIds: networkId,
		lineIds: lineId,
		positionTypes,
		excludeScheduled,
		countryCodes,
	};

	const boundedLineIds = new Set<number>();
	const boundedJourneys = journeyStore
		.values()
		.filter((journey) => {
			if (!matchesMarkersFilter(journey, filter)) return false;
			if (journey.lineId !== undefined) boundedLineIds.add(journey.lineId);
			return true;
		})
		.toArray();

	if (includeMarker !== undefined && !boundedJourneys.some((journey) => journey.id === includeMarker)) {
		const additionalJourney = journeyStore.get(includeMarker);
		if (additionalJourney !== undefined) {
			boundedJourneys.push(additionalJourney);
			if (additionalJourney.lineId !== undefined) {
				boundedLineIds.add(additionalJourney.lineId);
			}
		}
	}

	const lines = keyBy(
		await database
			.select()
			.from(linesTable)
			.where(inArray(linesTable.id, Array.from(boundedLineIds))),
		(line) => line.id,
	);

	const items = boundedJourneys.map((journey) =>
		toMarker(journey, journey.lineId ? lines.get(journey.lineId) : undefined),
	);

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
	if (journey === undefined) {
		c.status(404);
		return c.json({ error: `No journey was found with id "${id}".` });
	}

	return c.json(await buildJourneyDetails(journey));
});

hono.get("/vehicle-journeys/:id/alerts", createParamValidator(getVehicleJourneyParams), async (c) => {
	const { id } = c.req.valid("param");

	const journey = journeyStore.get(id);
	if (journey === undefined) return c.json({ error: `No journey was found with id "${id}".` }, 404);

	return c.json({ items: await findJourneyAlerts(journey), at: Temporal.Now.instant() });
});

/**
 * Tracés d'une course en un seul appel : celui qu'elle suit, et les portions que sa déviation lui
 * fait abandonner. `/paths/:ref` reste servie pour les clients qui ne connaissent que le premier.
 */
hono.get("/vehicle-journeys/:id/paths", createParamValidator(getVehicleJourneyParams), async (c) => {
	const { id } = c.req.valid("param");

	const journey = journeyStore.get(id);
	if (journey === undefined) return c.json({ error: `No journey was found with id "${id}".` }, 404);
	if (journey.pathRef === undefined) return c.json({ error: `Journey "${id}" has no path.` }, 404);

	if (!redis.isReady) return c.json({ error: "Paths are temporarily unavailable." }, 503);

	const paths = await loadJourneyPaths(journey);
	if (paths === undefined) return c.json({ error: `No path was found for journey "${id}".` }, 404);

	return c.json(paths);
});

const getPathParams = z.object({
	ref: z.string(),
});

hono.get("/paths/:ref", createParamValidator(getPathParams), async (c) => {
	const { ref } = c.req.valid("param");

	if (!redis.isReady) return c.json({ error: "Paths are temporarily unavailable." }, 503);

	const rawPath = await redis.get(ref);
	if (rawPath === null) {
		c.status(404);
		return c.json({ error: `No path was found with ref "${ref}".` });
	}

	return c.json(JSON.parse(rawPath));
});
