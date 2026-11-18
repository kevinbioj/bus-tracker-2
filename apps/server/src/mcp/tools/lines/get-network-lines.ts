import { and, eq, isNull } from "drizzle-orm";
import * as z from "zod";

import { database } from "../../../core/database/database.js";
import { linesTable } from "../../../core/database/schema.js";
import { journeyStore } from "../../../core/store/journey-store.js";
import { normalizeSearchText } from "../../../utils/search-text.js";
import { idSchema } from "../../../utils/validator-helpers.js";
import { defineTool } from "../../define-tool.js";
import { compareLineNumbers } from "../../lookups/lines.js";
import { getNetwork } from "../../lookups/networks.js";
import {
	lineReferenceSchema,
	networkReferenceSchema,
	presentLineReference,
	presentNetworkReference,
} from "../../presenters/references.js";

export const getNetworkLinesTool = defineTool({
	name: "get_network_lines",
	title: "List lines of a network",
	description:
		"List the lines of a network in their official order, with the number of journeys and vehicles tracked on each right now.",
	icon: "line",
	input: z.object({
		networkId: idSchema.describe("Network id from search_networks."),
		lineNumber: z.string().max(30).optional().describe("Only keep lines whose number contains this text."),
		includeArchived: z.boolean().default(false).describe("Also list lines that no longer run."),
	}),
	output: z.object({
		network: networkReferenceSchema,
		lines: z.array(
			z.object({
				...lineReferenceSchema.shape,
				archived: z.boolean(),
				trackedJourneysNow: z.number(),
				trackedVehiclesNow: z.number(),
			}),
		),
	}),
	handler: async ({ networkId, lineNumber, includeArchived }) => {
		const network = await getNetwork(networkId);

		const lineList = await database
			.select()
			.from(linesTable)
			.where(and(eq(linesTable.networkId, networkId), includeArchived ? undefined : isNull(linesTable.archivedAt)));

		const journeysByLineId = Map.groupBy(
			journeyStore.values().filter((journey) => journey.networkId === networkId),
			(journey) => journey.lineId,
		);

		const needle = lineNumber !== undefined ? normalizeSearchText(lineNumber) : "";
		const lines = lineList
			.filter((line) => needle === "" || normalizeSearchText(line.number).includes(needle))
			.toSorted(
				(a, b) =>
					(a.sortOrder ?? lineList.length) - (b.sortOrder ?? lineList.length) || compareLineNumbers(a.number, b.number),
			)
			.map((line) => {
				const journeys = journeysByLineId.get(line.id) ?? [];
				return {
					...presentLineReference(line),
					archived: line.archivedAt !== null,
					trackedJourneysNow: journeys.length,
					trackedVehiclesNow: journeys.filter((journey) => journey.vehicle?.id !== undefined).length,
				};
			});

		return { network: presentNetworkReference(network), lines };
	},
});
