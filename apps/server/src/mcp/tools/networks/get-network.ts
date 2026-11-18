import {
	type DataSourceRealtimeFeed,
	type DataSourceStaticFeed,
	getVehicleJourneyPositionType,
} from "@bus-tracker/contracts";
import { and, asc, count, eq, isNull } from "drizzle-orm";
import * as z from "zod";

import { database } from "../../../core/database/database.js";
import { linesTable, operatorsTable } from "../../../core/database/schema.js";
import { getNetworkDataSources } from "../../../core/services/data-source-service.js";
import { journeyStore } from "../../../core/store/journey-store.js";
import { idSchema } from "../../../utils/validator-helpers.js";
import { defineTool } from "../../define-tool.js";
import { getNetwork } from "../../lookups/networks.js";
import { networkUrl } from "../../presenters/links.js";
import { nowIn, toLocalTime } from "../../presenters/time.js";

export const getNetworkTool = defineTool({
	name: "get_network",
	title: "Network details",
	description:
		"Details of a network: authority, region, operators, number of active lines, real-time tracking quality right now (GPS vs timetable-estimated journeys) and the open data feeds it is built from (with freshness).",
	icon: "network",
	input: z.object({
		networkId: idSchema.describe("Network id from search_networks."),
	}),
	output: z.object({
		now: z.string(),
		networkId: z.number(),
		name: z.string(),
		authority: z.string().nullable(),
		region: z.string().nullable(),
		countryCode: z.string(),
		timezone: z.string(),
		hasFleetData: z.boolean(),
		activeLineCount: z.number(),
		operators: z.array(z.object({ operatorId: z.number(), name: z.string() })),
		realtime: z.object({
			trackedJourneys: z.number(),
			gpsJourneys: z.number(),
			estimatedJourneys: z.number(),
			scheduledJourneys: z.number(),
			vehiclesInService: z.number(),
		}),
		dataSources: z.array(
			z.object({
				kind: z.string(),
				staticFeed: z.object({
					href: z.string(),
					lastModified: z.string().nullable().optional(),
					importedAt: z.string().optional(),
				}),
				realtimeFeeds: z.array(z.object({ href: z.string(), entityTypes: z.array(z.string()).optional() })),
				authenticated: z.boolean(),
				lastSeenAt: z.string(),
			}),
		),
		url: z.string(),
	}),
	handler: async ({ networkId }) => {
		const network = await getNetwork(networkId);

		const [operators, [lineCount], networkDataSources] = await Promise.all([
			database
				.select({ operatorId: operatorsTable.id, name: operatorsTable.name })
				.from(operatorsTable)
				.where(eq(operatorsTable.networkId, networkId))
				.orderBy(asc(operatorsTable.sortOrder), asc(operatorsTable.name)),
			database
				.select({ value: count() })
				.from(linesTable)
				.where(and(eq(linesTable.networkId, networkId), isNull(linesTable.archivedAt))),
			getNetworkDataSources(),
		]);

		const journeys = journeyStore
			.values()
			.filter((journey) => journey.networkId === networkId)
			.toArray();
		const positionTypes = journeys.map(getVehicleJourneyPositionType);
		const sources = networkDataSources.find((entry) => entry.network.id === networkId)?.sources ?? [];

		return {
			now: nowIn(network.timezone),
			networkId: network.id,
			name: network.name,
			authority: network.authority,
			region: network.region,
			countryCode: network.countryCode,
			timezone: network.timezone,
			hasFleetData: network.hasVehiclesFeature,
			activeLineCount: lineCount?.value ?? 0,
			operators,
			realtime: {
				trackedJourneys: journeys.length,
				gpsJourneys: positionTypes.filter((type) => type === "GPS").length,
				estimatedJourneys: positionTypes.filter((type) => type === "ESTIMATED").length,
				scheduledJourneys: positionTypes.filter((type) => type === "SCHEDULED").length,
				vehiclesInService: new Set(journeys.flatMap((journey) => journey.vehicle?.id ?? [])).size,
			},
			dataSources: sources.map((source) => ({
				kind: source.kind,
				staticFeed: source.staticFeed as DataSourceStaticFeed,
				realtimeFeeds: source.realtimeFeeds as DataSourceRealtimeFeed[],
				authenticated: source.authenticated,
				lastSeenAt: toLocalTime(source.lastSeenAt, network.timezone),
			})),
			url: networkUrl(network.id),
		};
	},
});
