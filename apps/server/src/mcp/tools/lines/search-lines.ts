import { and, ilike, inArray, isNull } from "drizzle-orm";
import * as z from "zod";

import { database } from "../../../core/database/database.js";
import { linesTable } from "../../../core/database/schema.js";
import { journeyStore } from "../../../core/store/journey-store.js";
import { escapeLikePattern, normalizeSearchText } from "../../../utils/search-text.js";
import { idSchema } from "../../../utils/validator-helpers.js";
import { defineTool } from "../../define-tool.js";
import { compareLineNumbers } from "../../lookups/lines.js";
import { loadNetworks, matchesNetwork } from "../../lookups/networks.js";
import {
	lineReferenceSchema,
	networkReferenceSchema,
	presentLineReference,
	presentNetworkReference,
} from "../../presenters/references.js";

const MAX_LINES = 30;

export const searchLinesTool = defineTool({
	name: "search_lines",
	title: "Search lines",
	description:
		"Find lines by their public number or name (e.g. 'T1', '5', 'Fast 2') across all networks, optionally restricted to a network by name or id. Shortcut to get a lineId without browsing a network first.",
	icon: "line",
	input: z.object({
		line: z.string().min(1).max(30).describe("Line number or part of it, as shown to passengers."),
		network: z
			.string()
			.max(100)
			.optional()
			.describe(
				"Network name, city or authority to disambiguate, e.g. 'TCL', 'Astuce', 'Rouen' or 'Métropole de Lyon'. When nothing matches, every network is searched.",
			),
		networkId: idSchema.optional().describe("Exact network id from search_networks."),
		includeArchived: z.boolean().default(false).describe("Also return lines that no longer run."),
	}),
	output: z.object({
		networkFilterIgnored: z
			.boolean()
			.describe("True when no network matched the network text: lines of every network are returned instead."),
		total: z.number(),
		lines: z.array(
			z.object({
				...lineReferenceSchema.shape,
				network: networkReferenceSchema,
				archived: z.boolean(),
				trackedJourneysNow: z.number(),
			}),
		),
	}),
	handler: async ({ line, network, networkId, includeArchived }) => {
		const networks = await loadNetworks();

		const matchingNetworkIds =
			network !== undefined && network.trim() !== ""
				? [...networks.values()]
						.filter((candidate) => matchesNetwork(candidate, network))
						.map((candidate) => candidate.id)
				: undefined;
		const networkFilterIgnored = matchingNetworkIds !== undefined && matchingNetworkIds.length === 0;
		const networkIds = networkId !== undefined ? [networkId] : networkFilterIgnored ? undefined : matchingNetworkIds;

		const rows = await database
			.select()
			.from(linesTable)
			.where(
				and(
					ilike(linesTable.number, `%${escapeLikePattern(line.trim())}%`),
					networkIds !== undefined ? inArray(linesTable.networkId, networkIds) : undefined,
					includeArchived ? undefined : isNull(linesTable.archivedAt),
				),
			);

		const exact = normalizeSearchText(line);
		const trackedJourneys = Map.groupBy(journeyStore.values(), (journey) => journey.lineId);

		const lines = rows
			.toSorted(
				(a, b) =>
					Number(normalizeSearchText(b.number) === exact) - Number(normalizeSearchText(a.number) === exact) ||
					(trackedJourneys.get(b.id)?.length ?? 0) - (trackedJourneys.get(a.id)?.length ?? 0) ||
					compareLineNumbers(a.number, b.number),
			)
			.flatMap((row) => {
				const lineNetwork = networks.get(row.networkId);
				if (lineNetwork === undefined) return [];
				return [
					{
						...presentLineReference(row),
						network: presentNetworkReference(lineNetwork),
						archived: row.archivedAt !== null,
						trackedJourneysNow: trackedJourneys.get(row.id)?.length ?? 0,
					},
				];
			});

		return { networkFilterIgnored, total: lines.length, lines: lines.slice(0, MAX_LINES) };
	},
});
