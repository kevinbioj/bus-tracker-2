import * as z from "zod";

import { buildNearbyDepartures } from "../core/services/nearby-departures-service.js";
import { buildStopAlerts, buildStopDepartures, findStopMarkers } from "../core/services/stop-board-service.js";
import { hono } from "../server.js";
import {
	BOUNDS_ERROR,
	boundsQueryShape,
	createParamValidator,
	createQueryValidator,
	idListSchema,
	isOrderedBounds,
	MAX_NETWORK_IDS,
} from "../utils/validator-helpers.js";

const getStopMarkersQuery = z
	.object({
		...boundsQueryShape,
		networkId: idListSchema(MAX_NETWORK_IDS),
		// Lignes filtrées sur la carte : seules les stations qu'elles desservent.
		lineId: idListSchema(50),
		// Les quais ne servent qu'aux zooms les plus forts : inutile de les transporter en deçà.
		withStopPoints: z
			.enum(["true", "false"])
			.default("false")
			.transform((value) => value === "true"),
	})
	.refine(isOrderedBounds, BOUNDS_ERROR);

hono.get("/stops/markers", createQueryValidator(getStopMarkersQuery), async (c) => {
	const { networkId, lineId, ...filter } = c.req.valid("query");
	const items = await findStopMarkers({ ...filter, networkIds: networkId, lineIds: lineId });
	return c.json({ items, at: Temporal.Now.instant() });
});

const getNearbyDeparturesQuery = z.object({
	latitude: z.coerce.number().min(-90).max(90),
	longitude: z.coerce.number().min(-180).max(180),
});

hono.get("/stops/nearby", createQueryValidator(getNearbyDeparturesQuery), async (c) => {
	return c.json(await buildNearbyDepartures(c.req.valid("query")));
});

const getStopParams = z.object({
	ref: z.string(),
});

const getStopDeparturesQuery = z.object({
	direction: z.enum(["departures", "arrivals"]).default("departures"),
	// Lignes filtrées sur la carte : le tableau ne présente qu'elles.
	lineId: idListSchema(50),
});

hono.get(
	"/stops/:ref/departures",
	createParamValidator(getStopParams),
	createQueryValidator(getStopDeparturesQuery),
	async (c) => {
		const { ref } = c.req.valid("param");
		const { direction, lineId } = c.req.valid("query");

		const result = await buildStopDepartures(ref, direction, lineId);
		if ("error" in result) return c.json({ error: result.error }, result.status);
		return c.json(result.payload);
	},
);

hono.get("/stops/:ref/alerts", createParamValidator(getStopParams), async (c) => {
	const { ref } = c.req.valid("param");

	const items = await buildStopAlerts(ref);
	if (items === undefined) {
		return c.json({ error: `No stop area was found for ref "${ref}".` }, 404);
	}

	return c.json({ items, at: Temporal.Now.instant() });
});
