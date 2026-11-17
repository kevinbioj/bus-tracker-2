import { getVehicleJourneyPositionType, type TranslatedText } from "@bus-tracker/contracts";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { and, asc, desc, eq, ilike, inArray, isNull } from "drizzle-orm";
import * as z from "zod";

import { buildStopDepartures } from "../../controllers/stops.js";
import { siteUrl } from "../../options.js";
import { redactError } from "../../server.js";
import type { DisposeableVehicleJourney } from "../../types/disposeable-vehicle-journey.js";
import { useCache } from "../../utils/use-cache.js";
import { idSchema } from "../../utils/validator-helpers.js";
import { database } from "../database/database.js";
import {
	lineActivitiesTable,
	linesTable,
	networksTable,
	operatorsTable,
	regionsTable,
	vehiclesTable,
} from "../database/schema.js";
import { findRecentLineDestinations } from "../services/line-destination-service.js";
import { resolveLineRefs } from "../services/line-ref-service.js";
import type { ExposedServiceAlert } from "../services/service-alert-service.js";
import { findLineAlerts } from "../services/service-alert-service.js";
import { findStopAreasWithin } from "../services/stop-area-service.js";
import { findJourneysByVehicleId, findOnlineLineId, journeyStore } from "../store/journey-store.js";

const SERVER_INSTRUCTIONS = `Bus Tracker (${siteUrl}) tracks public transport vehicles (buses, trams, coaches, ferries…) in real time, mostly in France.
Typical workflow:
- Unknown network id: call search_networks first. Unknown line id: call get_network_lines.
- Real-time vehicles on a line and traffic alerts: get_line_status.
- Next departures at a stop: find_stops (needs approximate coordinates of the place) then get_stop_departures.
- Fleet questions (a given bus number, its features, where it runs): search_vehicles then get_vehicle.
All times are local to the network, ISO 8601 with UTC offset. Positions labelled ESTIMATED or SCHEDULED are computed from timetables, not GPS.
Cite the provided url fields when pointing users to Bus Tracker.`;

const MAX_LISTED_NETWORKS = 50;
const MAX_LISTED_VEHICLES = 25;
const MAX_LISTED_JOURNEYS = 100;
const MAX_LISTED_STOPS = 20;
const MAX_JOURNEY_CALLS = 80;
const MAX_NEXT_CALLS = 5;
const RECENT_ACTIVITY_COUNT = 10;
const EARTH_RADIUS_M = 6_371_000;

type NetworkSummary = {
	id: number;
	ref: string;
	name: string;
	authority: string | null;
	countryCode: string;
	timezone: string;
	hasVehiclesFeature: boolean;
	region: string | null;
};

const networksCache = useCache<Map<number, NetworkSummary>>(60_000, 1);

async function loadNetworks() {
	const cached = networksCache.get("all");
	if (cached !== undefined) return cached;

	const rows = await database
		.select({ network: networksTable, regionName: regionsTable.name })
		.from(networksTable)
		.leftJoin(regionsTable, eq(regionsTable.id, networksTable.regionId));

	const networks = new Map(
		rows.map(({ network, regionName }) => [
			network.id,
			{
				id: network.id,
				ref: network.ref,
				name: network.name,
				authority: network.authority,
				countryCode: network.countryCode,
				timezone: network.timezone,
				hasVehiclesFeature: network.hasVehiclesFeature,
				region: regionName !== null ? (regionName.fr ?? Object.values(regionName)[0] ?? null) : null,
			},
		]),
	);
	networksCache.set("all", networks);
	return networks;
}

type LineSummary = { id: number; number: string; type: string | null; networkId: number };

async function loadLines(lineIds: Iterable<number>) {
	const ids = [...new Set(lineIds)];
	if (ids.length === 0) return new Map<number, LineSummary>();

	const rows = await database
		.select({ id: linesTable.id, number: linesTable.number, type: linesTable.type, networkId: linesTable.networkId })
		.from(linesTable)
		.where(inArray(linesTable.id, ids));
	return new Map(rows.map((line) => [line.id, line]));
}

const normalize = (value: string) =>
	value
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase()
		.trim();

const escapeLikePattern = (value: string) => value.replace(/[\\%_]/g, "\\$&");

const toLocalTime = (value: string | Temporal.Instant, timezone: string) =>
	Temporal.Instant.from(value).toZonedDateTimeISO(timezone).toString({ smallestUnit: "minute", timeZoneName: "never" });

const nowIn = (timezone: string) => toLocalTime(Temporal.Now.instant(), timezone);

const minutesBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 60_000);

const pickText = (texts: TranslatedText | undefined) =>
	texts?.find((text) => text.language === undefined || text.language.startsWith("fr"))?.text ?? texts?.[0]?.text;

const stripHtml = (value: string | undefined) =>
	value
		?.replace(/<br\s*\/?>|<\/p>/gi, "\n")
		.replace(/<[^>]+>/g, "")
		.replace(/&nbsp;/g, " ")
		.replace(/\n{3,}/g, "\n\n")
		.trim();

const formatAlert = (alert: ExposedServiceAlert) => ({
	header: pickText(alert.header),
	description: stripHtml(pickText(alert.description)),
	cause: alert.cause,
	effect: alert.effect,
	severity: alert.severity,
	activePeriods: alert.activePeriods,
	url: pickText(alert.url),
});

const networkUrl = (networkId: number) => `${siteUrl}/data/networks/${networkId}`;
const lineUrl = (lineId: number) => `${siteUrl}/data/lines/${lineId}`;
const vehicleUrl = (vehicleId: number) => `${siteUrl}/data/vehicles/${vehicleId}`;

function nextCallsOf(journey: DisposeableVehicleJourney, timezone: string, count: number) {
	return (journey.calls ?? []).slice(0, count).map((call) => ({
		stop: call.stopName,
		platform: call.platformName,
		scheduled: toLocalTime(call.aimedTime, timezone),
		expected: call.expectedTime !== undefined ? toLocalTime(call.expectedTime, timezone) : undefined,
		status: call.callStatus,
	}));
}

function delayMinutesOf(journey: DisposeableVehicleJourney) {
	const call = journey.calls?.find((candidate) => candidate.callStatus !== "SKIPPED");
	if (call?.expectedTime === undefined) return undefined;
	return minutesBetween(call.aimedTime, call.expectedTime);
}

function summarizeJourney(
	journey: DisposeableVehicleJourney,
	timezone: string,
	lineNumber: string | undefined,
	nextCallCount = 1,
) {
	return {
		journeyId: journey.id,
		line: lineNumber,
		lineId: journey.lineId,
		destination: journey.destination,
		direction: journey.direction,
		vehicleNumber: journey.vehicle?.number,
		vehicleId: journey.vehicle?.id,
		positionType: getVehicleJourneyPositionType(journey),
		atStop: journey.position.atStop,
		delayMinutes: delayMinutesOf(journey),
		nextCalls: nextCallsOf(journey, timezone, nextCallCount),
		occupancy: journey.occupancy,
		wheelchairAccessible: journey.wheelchairAccessible,
		position: { latitude: journey.position.latitude, longitude: journey.position.longitude },
		positionRecordedAt: toLocalTime(journey.position.recordedAt, timezone),
	};
}

const ok = (data: unknown): CallToolResult => ({ content: [{ type: "text", text: JSON.stringify(data) }] });

const fail = (message: string): CallToolResult => ({ content: [{ type: "text", text: message }], isError: true });

const guarded =
	<Args>(name: string, handler: (args: Args) => Promise<CallToolResult>) =>
	async (args: Args) => {
		try {
			return await handler(args);
		} catch (error) {
			console.error("✘ MCP tool '%s' failed:", name, redactError(error));
			return fail("Internal error while fetching Bus Tracker data. Try again later.");
		}
	};

const readOnly = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const;

export function createMcpServer() {
	const server = new McpServer(
		{ name: "bus-tracker", title: "Bus Tracker", version: "1.0.0", websiteUrl: siteUrl },
		{ instructions: SERVER_INSTRUCTIONS },
	);

	server.registerTool(
		"search_networks",
		{
			title: "Search transport networks",
			description:
				"Find public transport networks tracked by Bus Tracker by name, city, authority or region. Returns network ids needed by other tools, and how many vehicles are currently tracked.",
			inputSchema: {
				query: z
					.string()
					.max(100)
					.optional()
					.describe("Free text matched against network name, authority and region, e.g. 'Rouen' or 'Astuce'."),
			},
			annotations: readOnly,
		},
		guarded("search_networks", async ({ query }) => {
			const networks = [...(await loadNetworks()).values()];
			const onlineCounts = Map.groupBy(journeyStore.values(), (journey) => journey.networkId);

			const needle = query !== undefined ? normalize(query) : "";
			const matches = networks
				.filter(
					(network) =>
						needle === "" ||
						[network.name, network.authority, network.region, network.ref].some(
							(field) => field !== null && normalize(field).includes(needle),
						),
				)
				.map((network) => ({
					networkId: network.id,
					name: network.name,
					authority: network.authority,
					region: network.region,
					countryCode: network.countryCode,
					hasFleetData: network.hasVehiclesFeature,
					trackedJourneysNow: onlineCounts.get(network.id)?.length ?? 0,
					url: networkUrl(network.id),
				}))
				.toSorted((a, b) => b.trackedJourneysNow - a.trackedJourneysNow || a.name.localeCompare(b.name));

			return ok({
				total: matches.length,
				networks: matches.slice(0, MAX_LISTED_NETWORKS),
				truncated: matches.length > MAX_LISTED_NETWORKS,
			});
		}),
	);

	server.registerTool(
		"get_network_lines",
		{
			title: "List lines of a network",
			description:
				"List the lines of a network with their current number of tracked journeys and vehicles. Use it to resolve a line number (e.g. 'T1', '5') into a lineId.",
			inputSchema: {
				networkId: idSchema.describe("Network id from search_networks."),
				lineNumber: z.string().max(20).optional().describe("Only keep lines whose number contains this text."),
				includeArchived: z.boolean().default(false).describe("Also list lines that no longer run."),
			},
			annotations: readOnly,
		},
		guarded("get_network_lines", async ({ networkId, lineNumber, includeArchived }) => {
			const network = (await loadNetworks()).get(networkId);
			if (network === undefined) return fail(`No network found with id ${networkId}.`);

			const lineList = await database
				.select()
				.from(linesTable)
				.where(and(eq(linesTable.networkId, networkId), includeArchived ? undefined : isNull(linesTable.archivedAt)));

			const journeysByLineId = Map.groupBy(
				journeyStore.values().filter((journey) => journey.networkId === networkId),
				(journey) => journey.lineId,
			);

			const needle = lineNumber !== undefined ? normalize(lineNumber) : "";
			const lines = lineList
				.filter((line) => needle === "" || normalize(line.number).includes(needle))
				.toSorted((a, b) => {
					const sortOrderDiff = (a.sortOrder ?? lineList.length) - (b.sortOrder ?? lineList.length);
					return sortOrderDiff || a.number.localeCompare(b.number, undefined, { numeric: true });
				})
				.map((line) => {
					const journeys = journeysByLineId.get(line.id) ?? [];
					return {
						lineId: line.id,
						number: line.number,
						type: line.type,
						archived: line.archivedAt !== null,
						trackedJourneysNow: journeys.length,
						trackedVehiclesNow: journeys.filter((journey) => journey.vehicle?.id !== undefined).length,
						url: lineUrl(line.id),
					};
				});

			return ok({ network: { networkId: network.id, name: network.name, url: networkUrl(network.id) }, lines });
		}),
	);

	server.registerTool(
		"get_line_status",
		{
			title: "Real-time status of a line",
			description:
				"Real-time snapshot of a line: every journey currently tracked (vehicle number, destination, delay, next stop, position), destinations seen recently and active traffic alerts.",
			inputSchema: {
				lineId: idSchema.describe("Line id from get_network_lines."),
			},
			annotations: readOnly,
		},
		guarded("get_line_status", async ({ lineId }) => {
			const [line] = await database.select().from(linesTable).where(eq(linesTable.id, lineId));
			if (line === undefined) return fail(`No line found with id ${lineId}.`);

			const network = (await loadNetworks()).get(line.networkId);
			const timezone = network?.timezone ?? "Europe/Paris";

			const journeys = journeyStore
				.values()
				.filter((journey) => journey.lineId === line.id)
				.map((journey) => summarizeJourney(journey, timezone, line.number))
				.toArray()
				.toSorted((a, b) =>
					(a.vehicleNumber ?? "~").localeCompare(b.vehicleNumber ?? "~", undefined, { numeric: true }),
				);

			const [recentDestinations, alerts] = await Promise.all([
				findRecentLineDestinations(line.id),
				findLineAlerts(line),
			]);

			return ok({
				now: nowIn(timezone),
				line: {
					lineId: line.id,
					number: line.number,
					type: line.type,
					archived: line.archivedAt !== null,
					network: network?.name,
					networkId: line.networkId,
					url: lineUrl(line.id),
				},
				trackedJourneyCount: journeys.length,
				journeys: journeys.slice(0, MAX_LISTED_JOURNEYS),
				recentDestinations,
				alerts: alerts.map(formatAlert),
			});
		}),
	);

	server.registerTool(
		"find_stops",
		{
			title: "Find stops around a place",
			description:
				"Find stops (stop areas) around coordinates, optionally filtered by name. Use your knowledge of the place to provide approximate coordinates (e.g. a city centre). Returns stop refs needed by get_stop_departures.",
			inputSchema: {
				latitude: z.number().min(-90).max(90),
				longitude: z.number().min(-180).max(180),
				radiusMeters: z.number().int().min(50).max(5_000).default(800),
				name: z.string().max(100).optional().describe("Only keep stops whose name contains this text."),
				networkId: idSchema.optional().describe("Only keep stops served by this network."),
			},
			annotations: readOnly,
		},
		guarded("find_stops", async ({ latitude, longitude, radiusMeters, name, networkId }) => {
			const latitudeDelta = (radiusMeters / EARTH_RADIUS_M) * (180 / Math.PI);
			const longitudeDelta = latitudeDelta / Math.max(Math.cos((latitude * Math.PI) / 180), 0.01);

			const stopAreas = await findStopAreasWithin(
				{
					swLat: latitude - latitudeDelta,
					swLon: longitude - longitudeDelta,
					neLat: latitude + latitudeDelta,
					neLon: longitude + longitudeDelta,
				},
				{ limit: 500, networkIds: networkId !== undefined ? [networkId] : undefined },
			);

			const needle = name !== undefined ? normalize(name) : "";
			const matches = stopAreas
				.map((stopArea) => ({ stopArea, distance: distanceMeters(latitude, longitude, stopArea) }))
				.filter(({ stopArea, distance }) => distance <= radiusMeters && normalize(stopArea.name).includes(needle))
				.toSorted((a, b) => a.distance - b.distance)
				.slice(0, MAX_LISTED_STOPS);

			const resolvedLines = await resolveLineRefs(matches.flatMap(({ stopArea }) => stopArea.lineRefs));
			const lines = await loadLines([...resolvedLines.values()].map((line) => line.id));
			const networks = await loadNetworks();

			return ok({
				stops: matches.map(({ stopArea, distance }) => ({
					stopRef: stopArea.ref,
					name: stopArea.name,
					mode: stopArea.mode ?? "BUS",
					distanceMeters: Math.round(distance),
					latitude: stopArea.latitude,
					longitude: stopArea.longitude,
					networks: stopArea.networkIds.flatMap((id) => networks.get(id)?.name ?? []),
					lines: [
						...new Set(
							stopArea.lineRefs.flatMap((ref) => {
								const lineId = resolvedLines.get(ref)?.id;
								return lineId !== undefined ? (lines.get(lineId)?.number ?? []) : [];
							}),
						),
					].toSorted((a, b) => a.localeCompare(b, undefined, { numeric: true })),
					hasArrivalsBoard: stopArea.arrivals === true,
				})),
			});
		}),
	);

	server.registerTool(
		"get_stop_departures",
		{
			title: "Next departures at a stop",
			description:
				"Next departures (or arrivals) at a stop within the next two hours, merging timetables, real-time predictions and tracked vehicles.",
			inputSchema: {
				stopRef: z.string().min(1).max(200).describe("Stop ref from find_stops."),
				lineId: idSchema.optional().describe("Only keep departures of this line."),
				direction: z
					.enum(["departures", "arrivals"])
					.default("departures")
					.describe("Arrivals are only available when find_stops reports hasArrivalsBoard."),
			},
			annotations: readOnly,
		},
		guarded("get_stop_departures", async ({ stopRef, lineId, direction }) => {
			const result = await buildStopDepartures(stopRef, direction, lineId);
			if ("error" in result) return fail(result.error ?? "Unable to compute departures.");

			const { stop, departures } = result.payload;
			const networks = await loadNetworks();
			const timezone = networks.get(stop.networkId)?.timezone ?? "Europe/Paris";
			const lines = await loadLines(departures.flatMap((departure) => departure.lineId ?? []));
			const nowMs = Date.now();

			return ok({
				now: nowIn(timezone),
				stop: {
					stopRef: stop.ref,
					name: stop.name,
					mode: stop.mode,
					networks: stop.networkIds.flatMap((id) => networks.get(id)?.name ?? []),
				},
				direction,
				departures: departures.map((departure) => {
					const effectiveTime = departure.expectedTime ?? departure.aimedTime;
					return {
						line: departure.lineId !== undefined ? lines.get(departure.lineId)?.number : undefined,
						lineId: departure.lineId,
						destination: departure.destination,
						origin: departure.originName,
						platform: departure.platformName,
						scheduled: toLocalTime(departure.aimedTime, timezone),
						expected: departure.expectedTime !== undefined ? toLocalTime(departure.expectedTime, timezone) : undefined,
						minutesAway: Math.max(0, Math.round((Date.parse(effectiveTime) - nowMs) / 60_000)),
						realtime: departure.realtime === true,
						cancelled: departure.callStatus === "SKIPPED",
						vehicleTracked: departure.tracked,
						vehicleAtStop: departure.atStop,
						onDemand: departure.onDemand,
						journeyId: departure.journeyId,
					};
				}),
			});
		}),
	);

	server.registerTool(
		"get_journey",
		{
			title: "Details of a tracked journey",
			description:
				"Full real-time details of a journey currently tracked: vehicle, position, delay and all its remaining stops with times.",
			inputSchema: {
				journeyId: z
					.string()
					.min(1)
					.max(300)
					.describe("journeyId from get_line_status, get_stop_departures or get_vehicle."),
			},
			annotations: readOnly,
		},
		guarded("get_journey", async ({ journeyId }) => {
			const journey = journeyStore.get(journeyId);
			if (journey === undefined) return fail(`Journey ${journeyId} is not tracked anymore.`);

			const network = (await loadNetworks()).get(journey.networkId);
			const timezone = network?.timezone ?? "Europe/Paris";
			const line = journey.lineId !== undefined ? (await loadLines([journey.lineId])).get(journey.lineId) : undefined;

			return ok({
				now: nowIn(timezone),
				network: network?.name,
				...summarizeJourney(journey, timezone, line?.number, MAX_JOURNEY_CALLS),
				bikesAllowed: journey.bikesAllowed,
				missionCode: journey.missionCode,
			});
		}),
	);

	server.registerTool(
		"search_vehicles",
		{
			title: "Search vehicles of a network",
			description:
				"Search the fleet of a network by fleet number or model designation. Tells whether each vehicle is currently in service and on which line.",
			inputSchema: {
				networkId: idSchema.describe("Network id from search_networks."),
				number: z.string().max(50).optional().describe("Fleet number, or part of it."),
				designation: z.string().max(100).optional().describe("Model, e.g. 'Citaro' or 'Urbanway'."),
				includeArchived: z.boolean().default(false).describe("Also list vehicles withdrawn from service."),
			},
			annotations: readOnly,
		},
		guarded("search_vehicles", async ({ networkId, number, designation, includeArchived }) => {
			const network = (await loadNetworks()).get(networkId);
			if (network === undefined) return fail(`No network found with id ${networkId}.`);

			const vehicleList = await database
				.select()
				.from(vehiclesTable)
				.where(
					and(
						eq(vehiclesTable.networkId, networkId),
						number !== undefined ? ilike(vehiclesTable.number, `%${escapeLikePattern(number)}%`) : undefined,
						designation !== undefined
							? ilike(vehiclesTable.designation, `%${escapeLikePattern(designation)}%`)
							: undefined,
						includeArchived ? undefined : isNull(vehiclesTable.archivedAt),
					),
				)
				.orderBy(asc(vehiclesTable.number))
				.limit(MAX_LISTED_VEHICLES + 1);

			const onlineLineIds = new Map(
				vehicleList.flatMap((vehicle) => {
					const lineId = findOnlineLineId(vehicle.id);
					return lineId !== undefined ? [[vehicle.id, lineId] as const] : [];
				}),
			);
			const lines = await loadLines(onlineLineIds.values());

			return ok({
				network: network.name,
				vehicles: vehicleList
					.slice(0, MAX_LISTED_VEHICLES)
					.toSorted((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))
					.map((vehicle) => {
						const lineId = onlineLineIds.get(vehicle.id);
						return {
							vehicleId: vehicle.id,
							number: vehicle.number,
							designation: vehicle.designation,
							type: vehicle.type,
							inService: lineId !== undefined,
							currentLine: lineId !== undefined ? lines.get(lineId)?.number : undefined,
							lastSeenAt: vehicle.lastSeenAt !== null ? toLocalTime(vehicle.lastSeenAt, network.timezone) : null,
							archived: vehicle.archivedAt !== null,
							url: vehicleUrl(vehicle.id),
						};
					}),
				truncated: vehicleList.length > MAX_LISTED_VEHICLES,
			});
		}),
	);

	server.registerTool(
		"get_vehicle",
		{
			title: "Details of a vehicle",
			description:
				"Details of a vehicle: model, operator, equipment, current journey if in service (line, destination, next stops, position) and its most recent line assignments.",
			inputSchema: {
				vehicleId: idSchema.describe("Vehicle id from search_vehicles."),
			},
			annotations: readOnly,
		},
		guarded("get_vehicle", async ({ vehicleId }) => {
			const [data] = await database
				.select({ vehicle: vehiclesTable, operatorName: operatorsTable.name })
				.from(vehiclesTable)
				.leftJoin(operatorsTable, eq(operatorsTable.id, vehiclesTable.operatorId))
				.where(eq(vehiclesTable.id, vehicleId));
			if (data === undefined) return fail(`No vehicle found with id ${vehicleId}.`);

			const { vehicle, operatorName } = data;
			const network = (await loadNetworks()).get(vehicle.networkId);
			const timezone = network?.timezone ?? "Europe/Paris";

			const recentActivities = await database
				.select({
					lineId: lineActivitiesTable.lineId,
					serviceDate: lineActivitiesTable.serviceDate,
					startedAt: lineActivitiesTable.startedAt,
					updatedAt: lineActivitiesTable.updatedAt,
				})
				.from(lineActivitiesTable)
				.where(eq(lineActivitiesTable.vehicleId, vehicle.id))
				.orderBy(desc(lineActivitiesTable.startedAt))
				.limit(RECENT_ACTIVITY_COUNT);

			const journey = findJourneysByVehicleId().get(vehicle.id);
			const onlineLineId = findOnlineLineId(vehicle.id);
			const lines = await loadLines([
				...recentActivities.map((activity) => activity.lineId),
				...(journey?.lineId !== undefined ? [journey.lineId] : []),
				...(onlineLineId !== undefined ? [onlineLineId] : []),
			]);

			return ok({
				now: nowIn(timezone),
				vehicleId: vehicle.id,
				number: vehicle.number,
				designation: vehicle.designation,
				type: vehicle.type,
				network: network?.name,
				networkId: vehicle.networkId,
				operator: operatorName,
				airConditioning: vehicle.airConditioning,
				usbPorts: vehicle.usbPorts,
				archived: vehicle.archivedAt !== null,
				archivedFor: vehicle.archivedFor,
				inService: onlineLineId !== undefined,
				currentLine: onlineLineId !== undefined ? lines.get(onlineLineId)?.number : undefined,
				currentJourney:
					journey !== undefined
						? summarizeJourney(
								journey,
								timezone,
								journey.lineId !== undefined ? lines.get(journey.lineId)?.number : undefined,
								MAX_NEXT_CALLS,
							)
						: undefined,
				lastSeenAt: vehicle.lastSeenAt !== null ? toLocalTime(vehicle.lastSeenAt, timezone) : null,
				recentLineAssignments: recentActivities.map((activity) => ({
					line: lines.get(activity.lineId)?.number,
					lineId: activity.lineId,
					serviceDate: activity.serviceDate,
					from: toLocalTime(activity.startedAt, timezone),
					to: toLocalTime(activity.updatedAt, timezone),
				})),
				url: vehicleUrl(vehicle.id),
			});
		}),
	);

	return server;
}

function distanceMeters(latitude: number, longitude: number, target: { latitude: number; longitude: number }) {
	const toRadians = Math.PI / 180;
	const dLat = (target.latitude - latitude) * toRadians;
	const dLon = (target.longitude - longitude) * toRadians;
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(latitude * toRadians) * Math.cos(target.latitude * toRadians) * Math.sin(dLon / 2) ** 2;
	return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}
