import {
	type EncodedLinePath,
	type EncodedVehicleJourneyPaths,
	encodeJourneyPath,
	encodeLinePath,
	REALTIME_PROTOCOL_VERSION,
	type RealtimeClientMessage,
	type RealtimeJourneyUpdate,
	type RealtimeServerMessage,
	type RealtimeStopWatch,
	type RealtimeUpdateMessage,
	realtimeClientMessageSchema,
	type VehicleJourneyMarker,
} from "@bus-tracker/contracts";
import { upgradeWebSocket } from "@hono/node-server";
import { createMiddleware } from "hono/factory";
import type { WebSocket } from "ws";

import { type LineDetails, loadLineDetails, loadLinePath } from "../core/services/line-details-service.js";
import { type ExposedServiceAlert, findJourneyAlerts, findLineAlerts } from "../core/services/service-alert-service.js";
import { buildJourneyDetails, type JourneyDetails } from "../core/services/vehicle-journey-details.js";
import {
	loadLineStyles,
	type MarkersFilter,
	matchesMarkersFilter,
	toMarker,
} from "../core/services/vehicle-journey-markers.js";
import { loadJourneyPaths } from "../core/services/vehicle-journey-paths.js";
import { journeyStore, onJourneysChanged } from "../core/store/journey-store.js";
import { redis } from "../index.js";
import { allowedOrigins, hono } from "../server.js";
import type { DisposeableVehicleJourney } from "../types/disposeable-vehicle-journey.js";
import { useCache } from "../utils/use-cache.js";
import {
	buildStopAlerts,
	buildStopDepartures,
	buildStopMarkers,
	onStopAreasInvalidated,
	type StopDeparturesPayload,
	type StopMarker,
	type StopMarkersFilter,
} from "./stops.js";

const FLUSH_INTERVAL_MS = 1_000;
const ALERTS_REFRESH_INTERVAL_MS = 30_000;
const STOP_DEPARTURES_REFRESH_INTERVAL_MS = 5_000;
const HEARTBEAT_INTERVAL_MS = 30_000;
const MAX_BUFFERED_BYTES = 1024 * 1024;

type Payloads = {
	journey: JourneyDetails;
	alert: ExposedServiceAlert;
	line: LineDetails;
	stopMarker: StopMarker;
	stopDepartures: StopDeparturesPayload;
};

type UpdateMessage = RealtimeUpdateMessage<Payloads>;

type JourneyContext = { journeyId: string; lineId?: number; pathsKey?: string; alertsKey?: string };

type LineContext = { lineId: number; alertsKey?: string };

type StopContext = { watch: RealtimeStopWatch; key: string; departuresKey?: string; alertsKey?: string };

type StopDeparturesResult = Awaited<ReturnType<typeof buildStopDepartures>>;

type Connection = {
	socket: WebSocket;
	subscription?: { seq: number; filter: MarkersFilter; includeMarker?: string };
	sent: Map<string, number>;
	watchedJourney: JourneyContext | null;
	lines: Map<number, LineContext>;
	watchedStop: StopContext | null;
	stops: { seq: number; filter: StopMarkersFilter } | null;
	sentStops: Map<string, number>;
	queue: Promise<void>;
	needsResync: boolean;
	isAlive: boolean;
};

const connections = new Set<Connection>();

const markers = new Map<string, { marker: VehicleJourneyMarker; version: number }>();
let nextMarkerVersion = 1;
let pendingJourneyIds = new Set<string>();
let isFlushing = false;

onJourneysChanged((journeyIds) => {
	for (const journeyId of journeyIds) pendingJourneyIds.add(journeyId);
});

function isSameMarker(a: VehicleJourneyMarker, b: VehicleJourneyMarker) {
	return (
		a.lineNumber === b.lineNumber &&
		a.vehicleNumber === b.vehicleNumber &&
		a.color === b.color &&
		a.fillColor === b.fillColor &&
		a.position.latitude === b.position.latitude &&
		a.position.longitude === b.position.longitude &&
		a.position.bearing === b.position.bearing &&
		a.position.type === b.position.type
	);
}

async function refreshMarkers(journeyIds: Set<string>) {
	const lineIds: number[] = [];
	for (const journeyId of journeyIds) {
		const lineId = journeyStore.get(journeyId)?.lineId;
		if (lineId !== undefined) lineIds.push(lineId);
	}

	const lineStyles = await loadLineStyles(lineIds);

	for (const journeyId of journeyIds) {
		const journey = journeyStore.get(journeyId);
		if (journey === undefined) {
			markers.delete(journeyId);
			continue;
		}

		const lineStyle = journey.lineId !== undefined ? lineStyles.get(journey.lineId) : undefined;
		if (journey.lineId !== undefined && lineStyle === undefined && pendingJourneyIds.has(journeyId)) continue;

		const marker = toMarker(journey, lineStyle);
		const known = markers.get(journeyId);
		if (known === undefined || !isSameMarker(known.marker, marker)) {
			markers.set(journeyId, { marker, version: nextMarkerVersion++ });
		}
	}
}

function isVisible(connection: Connection, journey: DisposeableVehicleJourney) {
	const { subscription } = connection;
	if (subscription === undefined) return false;
	return journey.id === subscription.includeMarker || matchesMarkersFilter(journey, subscription.filter);
}

function diffMarkers(connection: Connection, journeyIds: Iterable<string>) {
	const upsert: VehicleJourneyMarker[] = [];
	const remove: string[] = [];

	for (const journeyId of journeyIds) {
		const journey = journeyStore.get(journeyId);
		const entry = markers.get(journeyId);

		if (journey !== undefined && entry !== undefined && isVisible(connection, journey)) {
			if (connection.sent.get(journeyId) !== entry.version) {
				connection.sent.set(journeyId, entry.version);
				upsert.push(entry.marker);
			}
		} else if (connection.sent.delete(journeyId)) {
			remove.push(journeyId);
		}
	}

	return { upsert, remove };
}

function diffAllMarkers(connection: Connection) {
	const { upsert, remove } = diffMarkers(connection, journeyStore.keys());
	for (const journeyId of [...connection.sent.keys()]) {
		if (journeyStore.has(journeyId)) continue;
		connection.sent.delete(journeyId);
		remove.push(journeyId);
	}
	return { upsert, remove };
}

async function journeyUpdate(journeyId: string): Promise<RealtimeJourneyUpdate<JourneyDetails>> {
	const journey = journeyStore.get(journeyId);
	if (journey === undefined) return { id: journeyId, unavailable: true };

	try {
		return { id: journeyId, details: await buildJourneyDetails(journey) };
	} catch (error) {
		console.error(`✘ Failed to build details of journey '${journeyId}':`, error);
		return { id: journeyId, unavailable: true };
	}
}

function needsJourneyUpdate(connection: Connection, journeyIds: Set<string>) {
	const context = connection.watchedJourney;
	return context !== null && (connection.needsResync || journeyIds.has(context.journeyId));
}

async function buildWatchedJourneyUpdates(journeyIds: Set<string>) {
	const watchedJourneyIds = new Set<string>();
	for (const connection of connections) {
		if (needsJourneyUpdate(connection, journeyIds)) watchedJourneyIds.add(connection.watchedJourney!.journeyId);
	}

	const updates = await Promise.all(watchedJourneyIds.values().map(journeyUpdate));
	return new Map(updates.map((update) => [update.id, update]));
}

const lineDetailsCache = useCache<LineDetails | null>(60_000);
const linePathsCache = useCache<EncodedLinePath | null>(60_000);
const journeyPathsCache = useCache<EncodedVehicleJourneyPaths | null>(60_000);

async function cachedLineDetails(lineId: number) {
	const key = String(lineId);
	let line = lineDetailsCache.get(key);
	if (line === undefined) {
		line = (await loadLineDetails(lineId)) ?? null;
		lineDetailsCache.set(key, line);
	}
	return line;
}

async function cachedLinePath(line: LineDetails) {
	const key = String(line.id);
	let path = linePathsCache.get(key);
	if (path === undefined) {
		if (!redis.isReady) return undefined;
		const linePath = await loadLinePath(line);
		path = linePath !== undefined ? encodeLinePath(linePath) : null;
		linePathsCache.set(key, path);
	}
	return path;
}

async function cachedJourneyPaths(journey: DisposeableVehicleJourney, pathsKey: string) {
	let paths = journeyPathsCache.get(pathsKey);
	if (paths === undefined) {
		if (!redis.isReady) return undefined;
		const loaded = await loadJourneyPaths(journey);
		paths =
			loaded !== undefined
				? {
						path: encodeJourneyPath(loaded.path),
						cancelled: loaded.cancelled !== undefined ? encodeLinePath(loaded.cancelled) : undefined,
					}
				: null;
		journeyPathsCache.set(pathsKey, paths);
	}
	return paths;
}

async function composeJourney(
	message: UpdateMessage,
	context: JourneyContext,
	prebuiltUpdate?: RealtimeJourneyUpdate<JourneyDetails>,
) {
	message.journey = prebuiltUpdate ?? (await journeyUpdate(context.journeyId));

	const journey = journeyStore.get(context.journeyId);
	if (journey === undefined) return;

	if (journey.lineId !== undefined && journey.lineId !== context.lineId) {
		const line = await cachedLineDetails(journey.lineId);
		context.lineId = journey.lineId;
		message.lines = [...(message.lines ?? []), { lineId: journey.lineId, line }];
	}

	const pathsKey = `${journey.pathRef}|${journey.cancelledPathRef}`;
	if (journey.pathRef !== undefined && pathsKey !== context.pathsKey) {
		const paths = await cachedJourneyPaths(journey, pathsKey);
		if (paths !== undefined) {
			context.pathsKey = pathsKey;
			message.journeyPaths = { journeyId: context.journeyId, pathRef: journey.pathRef, paths };
		}
	}

	await composeJourneyAlerts(message, context, journey);
}

async function composeJourneyAlerts(
	message: UpdateMessage,
	context: JourneyContext,
	journey: DisposeableVehicleJourney,
) {
	const items = await findJourneyAlerts(journey);
	const alertsKey = JSON.stringify(items);
	if (alertsKey === context.alertsKey) return;

	context.alertsKey = alertsKey;
	message.journeyAlerts = { journeyId: context.journeyId, items };
}

async function composeLine(message: UpdateMessage, context: LineContext) {
	const line = await cachedLineDetails(context.lineId);
	message.lines = [...(message.lines ?? []), { lineId: context.lineId, line }];
	if (line === null) return;

	const path = await cachedLinePath(line);
	if (path !== undefined) {
		message.linePaths = [...(message.linePaths ?? []), { lineId: context.lineId, path }];
	}

	await composeLineAlerts(message, context, line);
}

async function composeLineAlerts(message: UpdateMessage, context: LineContext, line: LineDetails) {
	const items = await findLineAlerts(line);
	const alertsKey = JSON.stringify(items);
	if (alertsKey === context.alertsKey) return;

	context.alertsKey = alertsKey;
	message.lineAlerts = [...(message.lineAlerts ?? []), { lineId: context.lineId, items }];
}

function hashOf(value: string) {
	let hash = 0x811c9dc5;
	for (let index = 0; index < value.length; index++) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}
	return hash >>> 0;
}

async function composeStops(message: UpdateMessage, connection: Connection, seq: number) {
	const subscription = connection.stops;
	if (subscription === null || subscription.seq !== seq) return;

	const { items } = await buildStopMarkers(subscription.filter);
	if (connection.stops !== subscription) return;

	const upsert: StopMarker[] = [];
	const nextRefs = new Set<string>();
	for (const stop of items) {
		nextRefs.add(stop.ref);
		const hash = hashOf(JSON.stringify(stop));
		if (connection.sentStops.get(stop.ref) === hash) continue;
		connection.sentStops.set(stop.ref, hash);
		upsert.push(stop);
	}

	const remove: string[] = [];
	for (const ref of connection.sentStops.keys()) {
		if (nextRefs.has(ref)) continue;
		connection.sentStops.delete(ref);
		remove.push(ref);
	}

	message.stops = { seq, upsert, remove };
}

onStopAreasInvalidated(() => {
	for (const connection of connections) {
		const subscription = connection.stops;
		if (subscription !== null) {
			enqueue(connection, createUpdateMessage(), (message) => composeStops(message, connection, subscription.seq));
		}
	}
});

function stopKeyOf({ ref, direction, lineId }: RealtimeStopWatch) {
	return `${ref}|${direction}|${lineId ?? ""}`;
}

async function loadStopDepartures(watch: RealtimeStopWatch): Promise<StopDeparturesResult | undefined> {
	try {
		return await buildStopDepartures(watch.ref, watch.direction, watch.lineId);
	} catch (error) {
		console.error(`✘ Failed to build departures of stop '${watch.ref}':`, error);
		return undefined;
	}
}

async function composeStopDepartures(message: UpdateMessage, context: StopContext, prebuilt?: StopDeparturesResult) {
	const result = prebuilt ?? (await loadStopDepartures(context.watch));
	if (result === undefined) return;

	const { ref, direction, lineId } = context.watch;
	if ("error" in result) {
		if (context.departuresKey === "unavailable") return;
		context.departuresKey = "unavailable";
		message.stopDepartures = { ref, direction, lineId, unavailable: true };
		return;
	}

	const departuresKey = JSON.stringify({ ...result.payload, at: undefined });
	if (departuresKey === context.departuresKey) return;

	context.departuresKey = departuresKey;
	message.stopDepartures = { ref, direction, lineId, departures: result.payload };
}

async function composeStopAlerts(message: UpdateMessage, context: StopContext) {
	const items = await buildStopAlerts(context.watch.ref);
	if (items === undefined) return;

	const alertsKey = JSON.stringify(items);
	if (alertsKey === context.alertsKey) return;

	context.alertsKey = alertsKey;
	message.stopAlerts = { ref: context.watch.ref, items };
}

async function refreshStopDepartures() {
	const watches = new Map<string, RealtimeStopWatch>();
	for (const connection of connections) {
		const context = connection.watchedStop;
		if (context !== null) watches.set(context.key, context.watch);
	}
	if (watches.size === 0) return;

	const results = new Map(
		await Promise.all(watches.entries().map(async ([key, watch]) => [key, await loadStopDepartures(watch)] as const)),
	);

	for (const connection of connections) {
		const context = connection.watchedStop;
		if (context === null) continue;
		const result = results.get(context.key);
		if (result !== undefined) {
			enqueue(connection, createUpdateMessage(), (message) => composeStopDepartures(message, context, result));
		}
	}
}

function send(connection: Connection, message: RealtimeServerMessage<Payloads>) {
	if (connection.socket.readyState !== connection.socket.OPEN) return;
	connection.socket.send(JSON.stringify(message));
}

function enqueue(connection: Connection, message: UpdateMessage, compose?: (message: UpdateMessage) => Promise<void>) {
	connection.queue = connection.queue.then(async () => {
		if (compose !== undefined) {
			try {
				await compose(message);
			} catch (error) {
				console.error("✘ Failed to compose a realtime update:", error);
			}
		}

		if (Object.keys(message).length <= 2) return;
		message.at = Temporal.Now.instant().toString();
		send(connection, message);
	});
}

function createUpdateMessage(): UpdateMessage {
	return { type: "update", at: "" };
}

function flushConnection(
	connection: Connection,
	journeyIds: Set<string>,
	journeyUpdates: Map<string, RealtimeJourneyUpdate<JourneyDetails>>,
) {
	if (connection.socket.bufferedAmount > MAX_BUFFERED_BYTES) {
		connection.needsResync = true;
		return;
	}

	const context = needsJourneyUpdate(connection, journeyIds) ? connection.watchedJourney : null;
	const resync = connection.needsResync;
	connection.needsResync = false;

	const message = createUpdateMessage();

	if (connection.subscription !== undefined) {
		const { upsert, remove } = resync ? diffAllMarkers(connection) : diffMarkers(connection, journeyIds);
		if (upsert.length > 0 || remove.length > 0) {
			message.markers = { seq: connection.subscription.seq, upsert, remove };
		}
	}

	enqueue(
		connection,
		message,
		context !== null ? (message) => composeJourney(message, context, journeyUpdates.get(context.journeyId)) : undefined,
	);
}

function refreshAlerts(connection: Connection) {
	const context = connection.watchedJourney;
	const lineContexts = [...connection.lines.values()];
	const stopContext = connection.watchedStop;

	enqueue(connection, createUpdateMessage(), async (message) => {
		if (stopContext !== null) await composeStopAlerts(message, stopContext);

		const journey = context !== null ? journeyStore.get(context.journeyId) : undefined;
		if (context !== null && journey !== undefined) await composeJourneyAlerts(message, context, journey);

		for (const lineContext of lineContexts) {
			const line = await cachedLineDetails(lineContext.lineId);
			if (line !== null) await composeLineAlerts(message, lineContext, line);
		}
	});
}

async function flush() {
	if (isFlushing) return;
	if (pendingJourneyIds.size === 0 && !connections.values().some((connection) => connection.needsResync)) return;

	isFlushing = true;
	const journeyIds = pendingJourneyIds;
	pendingJourneyIds = new Set();

	try {
		await refreshMarkers(journeyIds);
		const journeyUpdates = await buildWatchedJourneyUpdates(journeyIds);
		for (const connection of connections) flushConnection(connection, journeyIds, journeyUpdates);
	} catch (error) {
		for (const journeyId of journeyIds) pendingJourneyIds.add(journeyId);
		console.error("✘ Failed to flush realtime updates:", error);
	} finally {
		isFlushing = false;
	}
}

setInterval(flush, FLUSH_INTERVAL_MS).unref();

setInterval(() => {
	for (const connection of connections) refreshAlerts(connection);
}, ALERTS_REFRESH_INTERVAL_MS).unref();

let isRefreshingStopDepartures = false;

setInterval(() => {
	if (isRefreshingStopDepartures) return;
	isRefreshingStopDepartures = true;
	refreshStopDepartures()
		.catch((error) => console.error("✘ Failed to refresh stop departures:", error))
		.finally(() => {
			isRefreshingStopDepartures = false;
		});
}, STOP_DEPARTURES_REFRESH_INTERVAL_MS).unref();

setInterval(() => {
	for (const connection of connections) {
		if (!connection.isAlive) {
			connection.socket.terminate();
			continue;
		}
		connection.isAlive = false;
		connection.socket.ping();
	}
}, HEARTBEAT_INTERVAL_MS).unref();

setInterval(() => {
	console.log("► %d realtime connection(s) open.", connections.size);
}, 60_000).unref();

function handleMessage(connection: Connection, message: RealtimeClientMessage) {
	if (message.type === "subscribe-markers") {
		const { seq, swLat, swLon, neLat, neLon, networkIds, lineIds, positionTypes, countryCodes, includeMarker } =
			message;

		connection.subscription = {
			seq,
			includeMarker,
			filter: {
				swLat,
				swLon,
				neLat,
				neLon,
				networkIds,
				lineIds,
				positionTypes,
				countryCodes: countryCodes !== undefined && countryCodes.length > 0 ? new Set(countryCodes) : undefined,
			},
		};

		const subscribedLineIds = new Set(lineIds ?? []);
		for (const lineId of connection.lines.keys()) {
			if (!subscribedLineIds.has(lineId)) connection.lines.delete(lineId);
		}

		const addedLines: LineContext[] = [];
		for (const lineId of subscribedLineIds) {
			if (connection.lines.has(lineId)) continue;
			const context: LineContext = { lineId };
			connection.lines.set(lineId, context);
			addedLines.push(context);
		}

		const { upsert, remove } = diffAllMarkers(connection);
		const update = createUpdateMessage();
		update.markers = { seq, upsert, remove };

		enqueue(
			connection,
			update,
			addedLines.length > 0
				? async (update) => {
						for (const context of addedLines) await composeLine(update, context);
					}
				: undefined,
		);
		return;
	}

	if (message.type === "subscribe-stops") {
		const { seq, subscription } = message;
		if (subscription === null) {
			connection.stops = null;
			connection.sentStops.clear();
			return;
		}

		connection.stops = { seq, filter: subscription };
		enqueue(connection, createUpdateMessage(), (update) => composeStops(update, connection, seq));
		return;
	}

	if (message.type === "watch-stop") {
		const watch = message.stop;
		connection.watchedStop = watch !== null ? { watch, key: stopKeyOf(watch) } : null;
		const stopContext = connection.watchedStop;
		if (stopContext !== null) {
			enqueue(connection, createUpdateMessage(), async (update) => {
				await composeStopDepartures(update, stopContext);
				await composeStopAlerts(update, stopContext);
			});
		}
		return;
	}

	connection.watchedJourney = message.id !== null ? { journeyId: message.id } : null;
	const context = connection.watchedJourney;
	if (context !== null) enqueue(connection, createUpdateMessage(), (update) => composeJourney(update, context));
}

export function closeRealtimeConnections() {
	for (const connection of connections) connection.socket.close(1012, "Server restarting");
}

hono.get(
	"/ws",
	createMiddleware(async (c, next) => {
		const origin = c.req.header("origin");
		if (origin !== undefined && !allowedOrigins.includes(origin)) return c.text("Origin not allowed.", 403);
		await next();
	}),
	upgradeWebSocket(() => {
		let connection: Connection | undefined;

		return {
			onOpen(_, ws) {
				const socket = ws.raw as WebSocket;
				const openedConnection: Connection = {
					socket,
					sent: new Map(),
					watchedJourney: null,
					lines: new Map(),
					watchedStop: null,
					stops: null,
					sentStops: new Map(),
					queue: Promise.resolve(),
					needsResync: false,
					isAlive: true,
				};
				socket.on("pong", () => {
					openedConnection.isAlive = true;
				});
				connection = openedConnection;
				connections.add(openedConnection);
				send(openedConnection, { type: "hello", version: REALTIME_PROTOCOL_VERSION });
			},
			onMessage(event) {
				if (connection === undefined || typeof event.data !== "string") return;

				let payload: unknown;
				try {
					payload = JSON.parse(event.data);
				} catch {
					connection.socket.close(1007, "Invalid JSON.");
					return;
				}

				const result = realtimeClientMessageSchema.safeParse(payload);
				if (!result.success) {
					connection.socket.close(1008, "Invalid message.");
					return;
				}

				handleMessage(connection, result.data);
			},
			onClose() {
				if (connection !== undefined) connections.delete(connection);
			},
		};
	}),
);
