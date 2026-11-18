import * as z from "zod";

import { searchStopAreas } from "../../../core/services/stop-search-service.js";
import { idSchema } from "../../../utils/validator-helpers.js";
import { defineTool, ToolFailure } from "../../define-tool.js";
import { presentStops, stopSummarySchema } from "../../presenters/stop.js";

export const searchStopsTool = defineTool({
	name: "search_stops",
	title: "Search stops by name",
	description:
		"Find stops (stop areas) by name, e.g. 'Gare Rive Droite' or 'Hôtel de Ville'. Names repeat across cities, so pass networkId whenever the network is known. Returns the stopRef needed by get_stop and get_stop_departures.",
	icon: "stop",
	input: z.object({
		name: z.string().min(2).max(100).describe("Stop name or part of it; accents and case are ignored."),
		networkId: idSchema.optional().describe("Only keep stops served by this network (from search_networks)."),
		limit: z.number().int().min(1).max(30).default(10),
	}),
	output: z.object({
		stops: z.array(stopSummarySchema),
	}),
	handler: async ({ name, networkId, limit }) => {
		const matches = await searchStopAreas({
			query: name,
			networkIds: networkId !== undefined ? [networkId] : undefined,
			limit,
		});
		if (matches === undefined) throw new ToolFailure("Stop search is temporarily unavailable. Try again later.");
		return { stops: await presentStops(matches) };
	},
});
