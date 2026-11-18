import * as z from "zod";

import { findLineRefs } from "../../../core/services/line-ref-service.js";
import { findStopAreasOfLine } from "../../../core/services/stop-search-service.js";
import { idSchema } from "../../../utils/validator-helpers.js";
import { defineTool, ToolFailure } from "../../define-tool.js";
import { getLine } from "../../lookups/lines.js";
import { lineReferenceSchema, presentLineReference } from "../../presenters/references.js";
import { presentStops, stopSummarySchema } from "../../presenters/stop.js";

const MAX_STOPS = 200;

export const getLineStopsTool = defineTool({
	name: "get_line_stops",
	title: "Stops served by a line",
	description:
		"Stops (stop areas) served by a line, sorted alphabetically — NOT in travel order. To know the order of stops, call get_line_status then get_journey on one of its journeys.",
	icon: "stop",
	input: z.object({
		lineId: idSchema.describe("Line id from search_lines or get_network_lines."),
	}),
	output: z.object({
		line: lineReferenceSchema,
		total: z.number(),
		stops: z.array(stopSummarySchema),
	}),
	handler: async ({ lineId }) => {
		const line = await getLine(lineId);
		const stopAreas = await findStopAreasOfLine(await findLineRefs(line.id));
		if (stopAreas === undefined) throw new ToolFailure("Stops are temporarily unavailable. Try again later.");

		return {
			line: presentLineReference(line),
			total: stopAreas.length,
			stops: await presentStops(stopAreas.slice(0, MAX_STOPS)),
		};
	},
});
