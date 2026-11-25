import { setTimeout } from "node:timers/promises";
import { LINE_PATH_TTL_SECONDS, VEHICLE_JOURNEYS_CHANNEL, WITHDRAWN_JOURNEYS_CHANNEL } from "@bus-tracker/contracts";
import { captureException } from "@bus-tracker/monitoring";
import type { RedisClient } from "@bus-tracker/redis";
import type { LimitFunction } from "p-limit";

import type { Source } from "../model/source.js";
import { createDeadline, DeadlineExceededError } from "../utils/deadline.js";
import { computeVehicleJourneys } from "./compute-current-journeys.js";
import { publishDataSourceManifests } from "./publish-data-sources.js";
import type { JourneyPathPublisher } from "./publish-journey-paths.js";
import { publishServiceAlerts } from "./publish-service-alerts.js";
import { getRealtimeServiceFingerprint, publishStopAreas } from "./publish-stop-areas.js";

const UPDATE_INTERVAL_MS = 600_000;
const FAILED_RESOURCE_CHECK_MS = 900_000;
const SWEEP_INTERVAL_MS = 300_000;
const STOP_AREAS_REFRESH_MS = 3_600_000;
const LINE_PATH_TTL_REFRESH_MS = 3_600_000;
const MIN_WAIT_MS = 5_000;
const MAX_WAIT_MS = 120_000;
const JOURNEYS_CHUNK_SIZE = 500;
export const STUCK_SOURCE_ITERATION_MS = 60_000;

export type SourceLoopContext = {
	providerId: string;
	sources: Source[];
	redis: RedisClient;
	computeDelayMs: number;
	sourceBudgetMs: number;
	computeLimit: LimitFunction;
	resourceLimit: LimitFunction;
	updateLimit: LimitFunction;
	journeyPaths: JourneyPathPublisher;
	resync: Set<string>;
	onStuck: (source: Source) => void;
	stuckAfterMs?: number;
	sleep?: (ms: number) => Promise<unknown>;
};

type SourceLoopState = {
	nextUpdateAt: number;
	lastSweepAt: number;
	lastStopAreasPublishAt: number;
	lastLinePathTtlRefreshAt: number;
	publishedRealtimeStopAreas: string;
};

export async function runSourceLoop(source: Source, context: SourceLoopContext): Promise<never> {
	const sleep = context.sleep ?? setTimeout;
	const state: SourceLoopState = {
		nextUpdateAt: Date.now() + UPDATE_INTERVAL_MS,
		lastSweepAt: Date.now(),
		lastStopAreasPublishAt: Date.now(),
		lastLinePathTtlRefreshAt: 0,
		publishedRealtimeStopAreas: "",
	};

	await runSafely(source, context, "GTFS import", async () => {
		if (await loadGtfs(source, state, () => context.resourceLimit(() => source.importGtfs()))) {
			await publishInventory(source, context, state);
		}
	});

	while (true) {
		await runSafely(source, context, "GTFS update", () => refreshResource(source, context, state));

		if (source.gtfs !== undefined && Date.now() - state.lastSweepAt > SWEEP_INTERVAL_MS) {
			source.sweepJourneys();
			state.lastSweepAt = Date.now();
		}

		if (source.gtfs === undefined || !context.redis.isReady) {
			await sleep(context.computeDelayMs);
			continue;
		}

		const startedAt = Date.now();
		await runSafely(source, context, "Cycle", () =>
			context.computeLimit(() => guardStuck(source, context, () => runIteration(source, context, state))),
		);
		const duration = Date.now() - startedAt;

		await sleep(Math.min(MAX_WAIT_MS, Math.max(MIN_WAIT_MS, context.computeDelayMs - duration)));
	}
}

async function runSafely(source: Source, context: SourceLoopContext, label: string, task: () => Promise<unknown>) {
	try {
		await task();
	} catch (error) {
		if (error instanceof DeadlineExceededError) {
			source.log.warn(`Computation exceeded its ${context.sourceBudgetMs}ms budget, skipped this cycle`);
			captureException(error, { sourceId: source.id, $exception_fingerprint: ["gtfs-compute-timeout", source.id] });
			return;
		}
		source.log.error(`${label} failed`, error);
		captureException(error, { sourceId: source.id });
	}
}

async function guardStuck<T>(source: Source, context: SourceLoopContext, task: () => Promise<T>) {
	let timer: NodeJS.Timeout | undefined;
	const stuck = new Promise<never>((_, reject) => {
		timer = globalThis.setTimeout(() => {
			context.onStuck(source);
			reject(new Error(`Iteration of source '${source.id}' is stuck.`));
		}, context.stuckAfterMs ?? STUCK_SOURCE_ITERATION_MS);
	});
	try {
		return await Promise.race([task(), stuck]);
	} finally {
		clearTimeout(timer);
	}
}

async function refreshResource(source: Source, context: SourceLoopContext, state: SourceLoopState) {
	if (Date.now() < state.nextUpdateAt) return;
	state.nextUpdateAt = Date.now() + UPDATE_INTERVAL_MS;

	const updated = await loadGtfs(source, state, () =>
		context.updateLimit(() => context.resourceLimit(() => source.updateGtfs())),
	);
	if (!updated) return;

	if (context.redis.isReady) {
		await publishInventory(source, context, state);
	} else {
		context.resync.add(source.id);
	}
}

async function loadGtfs(source: Source, state: SourceLoopState, load: () => Promise<boolean>) {
	const loaded = await load().catch((error: unknown) => {
		state.nextUpdateAt = Date.now() + FAILED_RESOURCE_CHECK_MS;
		throw error;
	});
	if (source.failedResource !== undefined) state.nextUpdateAt = Date.now() + FAILED_RESOURCE_CHECK_MS;
	return loaded;
}

async function runIteration(source: Source, context: SourceLoopContext, state: SourceLoopState) {
	const { redis, providerId } = context;

	if (context.resync.delete(source.id)) {
		await publishInventory(source, context, state);
	} else if (Date.now() - state.lastStopAreasPublishAt > STOP_AREAS_REFRESH_MS) {
		await publishStopAreas(redis, providerId, [source]);
		state.lastStopAreasPublishAt = Date.now();
	}

	try {
		await computeAndPublishJourneys(source, context, state);
	} finally {
		await publishDataSourceManifests(redis, providerId, context.sources);
		await publishServiceAlerts(redis, providerId, [source]);
	}
}

async function computeAndPublishJourneys(source: Source, context: SourceLoopContext, state: SourceLoopState) {
	const { redis, providerId } = context;
	const deadline = createDeadline(Date.now() + context.sourceBudgetMs);
	const { journeys, paths, withdrawnJourneyIds } = await computeVehicleJourneys(source, deadline);

	for (const journey of journeys) {
		source.observedNetworkRefs.add(journey.networkRef);
	}

	const realtimeStopAreasFingerprint = getRealtimeServiceFingerprint(source);
	if (realtimeStopAreasFingerprint !== state.publishedRealtimeStopAreas) {
		await publishStopAreas(redis, providerId, [source]);
		state.publishedRealtimeStopAreas = realtimeStopAreasFingerprint;
	}

	for (let i = 0; i < journeys.length; i += JOURNEYS_CHUNK_SIZE) {
		await redis.publish(VEHICLE_JOURNEYS_CHANNEL, JSON.stringify(journeys.slice(i, i + JOURNEYS_CHUNK_SIZE)));
	}

	if (withdrawnJourneyIds.length > 0) {
		await redis.publish(WITHDRAWN_JOURNEYS_CHANNEL, JSON.stringify(withdrawnJourneyIds));
	}

	await context.journeyPaths.publish(redis, paths, Date.now());
	await refreshLinePathTtls(source, context, state);
}

async function publishInventory(source: Source, context: SourceLoopContext, state: SourceLoopState) {
	const { redis, providerId } = context;
	await publishLinePaths(source, context, state);
	await publishDataSourceManifests(redis, providerId, context.sources, { force: true });
	await publishStopAreas(redis, providerId, [source]);
	state.lastStopAreasPublishAt = Date.now();
}

async function publishLinePaths(source: Source, context: SourceLoopContext, state: SourceLoopState) {
	try {
		await Promise.all(
			Array.from(source.linePaths, ([ref, path]) =>
				context.redis.set(ref, JSON.stringify(path), { EX: LINE_PATH_TTL_SECONDS }),
			),
		);
		state.lastLinePathTtlRefreshAt = Date.now();
	} catch (error) {
		source.log.error("Failed to publish line paths", error);
		captureException(error, { sourceId: source.id });
		context.resync.add(source.id);
	}
}

async function refreshLinePathTtls(source: Source, context: SourceLoopContext, state: SourceLoopState) {
	if (source.linePaths.size === 0) return;
	if (Date.now() - state.lastLinePathTtlRefreshAt < LINE_PATH_TTL_REFRESH_MS) return;

	await Promise.all(Array.from(source.linePaths.keys(), (ref) => context.redis.expire(ref, LINE_PATH_TTL_SECONDS)));
	state.lastLinePathTtlRefreshAt = Date.now();
}
