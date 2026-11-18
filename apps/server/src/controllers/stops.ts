import * as z from "zod";

import { buildStopAlerts, buildStopDepartures, findStopMarkers } from "../core/services/stop-board-service.js";
import { hono } from "../server.js";
import {
	BOUNDS_ERROR,
	boundsQueryShape,
	createParamValidator,
	createQueryValidator,
	idListSchema,
	idSchema,
	isOrderedBounds,
	MAX_NETWORK_IDS,
} from "../utils/validator-helpers.js";

const getStopMarkersQuery = z
	.object({
		...boundsQueryShape,
		networkId: idListSchema(MAX_NETWORK_IDS),
		// Ligne filtrée sur la carte : seules les stations qu'elle dessert.
		lineId: idSchema.optional(),
		// Les quais ne servent qu'aux zooms les plus forts : inutile de les transporter en deçà.
		withStopPoints: z
			.enum(["true", "false"])
			.default("false")
			.transform((value) => value === "true"),
	})
	.refine(isOrderedBounds, BOUNDS_ERROR);

hono.get("/stops/markers", createQueryValidator(getStopMarkersQuery), async (c) => {
	const { networkId, ...filter } = c.req.valid("query");
	const items = await findStopMarkers({ ...filter, networkIds: networkId });
	return c.json({ items, at: Temporal.Now.instant() });
});

const getStopParams = z.object({
	ref: z.string(),
});

const getStopDeparturesQuery = z.object({
	direction: z.enum(["departures", "arrivals"]).default("departures"),
	// Ligne filtrée sur la carte : le tableau ne présente qu'elle.
	lineId: idSchema.optional(),
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
