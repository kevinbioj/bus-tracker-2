import * as z from "zod";

import { findStopAreasWithin } from "../../../core/services/stop-area-service.js";
import { boundsAround, distanceMeters } from "../../../utils/geo.js";
import { normalizeSearchText } from "../../../utils/search-text.js";
import { idSchema } from "../../../utils/validator-helpers.js";
import { defineTool } from "../../define-tool.js";
import { presentStops, stopSummarySchema } from "../../presenters/stop.js";

const MAX_STOPS = 20;
const CANDIDATE_LIMIT = 500;

export const findStopsNearbyTool = defineTool({
	name: "find_stops_nearby",
	title: "Find stops around a place",
	description:
		"Find stops (stop areas) around coordinates, closest first, optionally filtered by name or network. Prefer search_stops when the stop name is known; use this for 'near me' or 'near this address' questions.",
	icon: "stop",
	input: z.object({
		latitude: z.number().min(-90).max(90),
		longitude: z.number().min(-180).max(180),
		radiusMeters: z.number().int().min(50).max(5_000).default(800),
		name: z.string().max(100).optional().describe("Only keep stops whose name contains this text."),
		networkId: idSchema.optional().describe("Only keep stops served by this network."),
	}),
	output: z.object({
		stops: z.array(stopSummarySchema),
	}),
	handler: async ({ latitude, longitude, radiusMeters, name, networkId }) => {
		const origin = { latitude, longitude };
		const stopAreas = await findStopAreasWithin(boundsAround(origin, radiusMeters), {
			limit: CANDIDATE_LIMIT,
			networkIds: networkId !== undefined ? [networkId] : undefined,
		});

		const needle = name !== undefined ? normalizeSearchText(name) : "";
		const nearby = stopAreas
			.map((stopArea) => ({ ...stopArea, distanceMeters: distanceMeters(origin, stopArea) }))
			.filter(
				(stopArea) => stopArea.distanceMeters <= radiusMeters && normalizeSearchText(stopArea.name).includes(needle),
			)
			.toSorted((a, b) => a.distanceMeters - b.distanceMeters)
			.slice(0, MAX_STOPS);

		return { stops: await presentStops(nearby) };
	},
});
