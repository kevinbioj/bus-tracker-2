import * as z from "zod";

import { journeyStore } from "../../../core/store/journey-store.js";
import { matchesSearchText } from "../../../utils/search-text.js";
import { defineTool } from "../../define-tool.js";
import { loadNetworks, matchesNetwork } from "../../lookups/networks.js";
import { networkUrl } from "../../presenters/links.js";

const MAX_NETWORKS = 50;

export const searchNetworksTool = defineTool({
	name: "search_networks",
	title: "Search transport networks",
	description:
		"Find public transport networks tracked by Bus Tracker by name, city, authority or region. Returns the networkId needed by most other tools and how many journeys are tracked right now. Call without arguments to browse all networks and the list of regions.",
	icon: "network",
	input: z.object({
		query: z
			.string()
			.max(100)
			.optional()
			.describe("Free text matched against network name, authority, region and reference, e.g. 'Rouen' or 'Astuce'."),
		region: z.string().max(100).optional().describe("Only keep networks of this region, e.g. 'Normandie'."),
		countryCode: z.string().length(2).optional().describe("ISO 3166-1 alpha-2 country code, e.g. 'FR'."),
	}),
	output: z.object({
		total: z.number(),
		truncated: z.boolean(),
		networks: z.array(
			z.object({
				networkId: z.number(),
				name: z.string(),
				authority: z.string().nullable(),
				region: z.string().nullable(),
				countryCode: z.string(),
				hasFleetData: z.boolean(),
				trackedJourneysNow: z.number(),
				url: z.string(),
			}),
		),
		regions: z.array(z.string()),
	}),
	handler: async ({ query, region, countryCode }) => {
		const networks = [...(await loadNetworks()).values()];
		const trackedJourneys = Map.groupBy(journeyStore.values(), (journey) => journey.networkId);

		const matches = networks
			.filter(
				(network) =>
					(query === undefined || matchesNetwork(network, query)) &&
					(region === undefined || matchesSearchText([network.region], region)) &&
					(countryCode === undefined || network.countryCode === countryCode.toUpperCase()),
			)
			.map((network) => ({
				networkId: network.id,
				name: network.name,
				authority: network.authority,
				region: network.region,
				countryCode: network.countryCode,
				hasFleetData: network.hasVehiclesFeature,
				trackedJourneysNow: trackedJourneys.get(network.id)?.length ?? 0,
				url: networkUrl(network.id),
			}))
			.toSorted((a, b) => b.trackedJourneysNow - a.trackedJourneysNow || a.name.localeCompare(b.name));

		return {
			total: matches.length,
			truncated: matches.length > MAX_NETWORKS,
			networks: matches.slice(0, MAX_NETWORKS),
			regions: [...new Set(networks.flatMap((network) => network.region ?? []))].toSorted((a, b) => a.localeCompare(b)),
		};
	},
});
