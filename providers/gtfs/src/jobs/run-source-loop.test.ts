import { setImmediate } from "node:timers/promises";
import { VEHICLE_JOURNEYS_CHANNEL, type VehicleJourney, WITHDRAWN_JOURNEYS_CHANNEL } from "@bus-tracker/contracts";
import { captureException } from "@bus-tracker/monitoring";
import type { RedisClient } from "@bus-tracker/redis";
import pLimit from "p-limit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Gtfs } from "../model/gtfs.js";
import { Source } from "../model/source.js";
import { DeadlineExceededError } from "../utils/deadline.js";
import { computeVehicleJourneys } from "./compute-current-journeys.js";
import { createJourneyPathPublisher } from "./publish-journey-paths.js";
import { publishStopAreas } from "./publish-stop-areas.js";
import { runSourceLoop, type SourceLoopContext } from "./run-source-loop.js";

vi.mock("@bus-tracker/monitoring", () => ({ captureException: vi.fn() }));
vi.mock("./compute-current-journeys.js", () => ({ computeVehicleJourneys: vi.fn() }));
vi.mock("./publish-data-sources.js", () => ({ publishDataSourceManifests: vi.fn() }));
vi.mock("./publish-service-alerts.js", () => ({ publishServiceAlerts: vi.fn() }));
vi.mock("./publish-stop-areas.js", () => ({
	publishStopAreas: vi.fn(),
	getRealtimeServiceFingerprint: vi.fn(() => ""),
}));

function makeSource(id: string, importGtfs: () => Promise<boolean> = async () => true) {
	const source = new Source(id, {
		staticResourceHref: "https://example.com/gtfs.zip",
		getNetworkRef: () => id.toUpperCase(),
	});
	vi.spyOn(source, "importGtfs").mockImplementation(async () => {
		const imported = await importGtfs();
		if (imported) source.gtfs = {} as Gtfs;
		return imported;
	});
	return source;
}

function journeyOf(source: Source) {
	return { id: source.id, networkRef: source.id.toUpperCase() } as VehicleJourney;
}

let stopped = false;

function makeContext(sources: Source[], overrides: Partial<SourceLoopContext> = {}) {
	const published: string[] = [];
	const redis = {
		isReady: true,
		publish: vi.fn(async (_channel: string, message: string) => {
			for (const { id } of JSON.parse(message) as VehicleJourney[]) published.push(id);
			return 1;
		}),
		set: vi.fn(async () => "OK"),
		expire: vi.fn(async () => 1),
	} as unknown as RedisClient;

	const context: SourceLoopContext = {
		providerId: "test",
		sources,
		redis,
		computeDelayMs: 0,
		sourceBudgetMs: 1_000,
		computeLimit: pLimit(2),
		resourceLimit: pLimit(2),
		updateLimit: pLimit(1),
		journeyPaths: createJourneyPathPublisher(900, 300_000),
		resync: new Set(),
		onStuck: vi.fn(),
		sleep: () => (stopped ? new Promise(() => {}) : setImmediate()),
		...overrides,
	};
	return { context, published };
}

async function waitFor(condition: () => boolean) {
	for (let attempt = 0; attempt < 2_000 && !condition(); attempt += 1) await setImmediate();
	expect(condition()).toBe(true);
}

const countOf = (published: string[], id: string) => published.filter((entry) => entry === id).length;

describe("runSourceLoop", () => {
	beforeEach(() => {
		stopped = false;
		vi.spyOn(console, "error").mockImplementation(() => {});
		vi.spyOn(console, "warn").mockImplementation(() => {});
		vi.mocked(computeVehicleJourneys).mockImplementation(async (source) => ({
			journeys: [journeyOf(source)],
			paths: {},
			withdrawnJourneyIds: [],
		}));
		vi.mocked(publishStopAreas).mockClear();
	});

	afterEach(() => {
		stopped = true;
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("publie une source sans attendre l'import d'une autre", async () => {
		const slow = makeSource("slow", () => new Promise(() => {}));
		const fast = makeSource("fast");
		const { context, published } = makeContext([slow, fast]);

		void runSourceLoop(slow, context);
		void runSourceLoop(fast, context);

		await waitFor(() => countOf(published, "fast") >= 3);
		expect(countOf(published, "slow")).toBe(0);
	});

	it("publie les courses retirées après celles du cycle", async () => {
		const source = makeSource("source");
		vi.mocked(computeVehicleJourneys).mockImplementation(async (source) => ({
			journeys: [journeyOf(source)],
			paths: {},
			withdrawnJourneyIds: ["withdrawn"],
		}));
		const { context, published } = makeContext([source]);

		void runSourceLoop(source, context);

		await waitFor(() => countOf(published, "source") >= 1);
		expect(vi.mocked(context.redis.publish).mock.calls.slice(0, 2)).toEqual([
			[VEHICLE_JOURNEYS_CHANNEL, JSON.stringify([journeyOf(source)])],
			[WITHDRAWN_JOURNEYS_CHANNEL, JSON.stringify(["withdrawn"])],
		]);
	});

	it("ne publie aucun retrait quand aucune course n'est retirée", async () => {
		const source = makeSource("source");
		const { context, published } = makeContext([source]);

		void runSourceLoop(source, context);

		await waitFor(() => countOf(published, "source") >= 2);
		expect(vi.mocked(context.redis.publish).mock.calls.map(([channel]) => channel)).not.toContain(
			WITHDRAWN_JOURNEYS_CHANNEL,
		);
	});

	it("remonte l'échec d'import au démarrage sans bloquer les autres sources", async () => {
		const error = new Error("Download from 'https://example.com/gtfs.zip' failed (503).");
		const broken = makeSource("broken", async () => {
			throw error;
		});
		const healthy = makeSource("healthy");
		const { context, published } = makeContext([broken, healthy]);
		vi.mocked(captureException).mockClear();

		void runSourceLoop(broken, context);
		void runSourceLoop(healthy, context);

		await waitFor(() => countOf(published, "healthy") >= 3);
		expect(captureException).toHaveBeenCalledWith(error, { sourceId: "broken" });
		expect(countOf(published, "broken")).toBe(0);
	});

	it("revérifie une ressource en échec toutes les 15 minutes", async () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		const startedAt = Date.now();
		const source = makeSource("source");
		const updateGtfs = vi
			.spyOn(source, "updateGtfs")
			.mockImplementationOnce(async () => {
				source.failedResource = { lastModified: null, etag: null, hash: "broken", checkedAt: Temporal.Now.instant() };
				throw new Error("broken archive");
			})
			.mockResolvedValue(false);
		vi.spyOn(source, "sweepJourneys").mockReturnValue(undefined);
		const { context, published } = makeContext([source]);

		const expectUpdateCallsAt = async (minutes: number, calls: number) => {
			vi.setSystemTime(startedAt + minutes * 60_000);
			const publishedBefore = countOf(published, "source");
			await waitFor(() => countOf(published, "source") >= publishedBefore + 3);
			expect(updateGtfs).toHaveBeenCalledTimes(calls);
		};

		void runSourceLoop(source, context);
		await waitFor(() => countOf(published, "source") >= 1);

		await expectUpdateCallsAt(11, 1);
		await expectUpdateCallsAt(25, 1);
		await expectUpdateCallsAt(27, 2);
		await expectUpdateCallsAt(41, 2);
		await expectUpdateCallsAt(43, 3);
	});

	it("poursuit les boucles quand le calcul d'une source échoue ou dépasse son budget", async () => {
		const failing = makeSource("failing");
		const healthy = makeSource("healthy");
		let failingCalls = 0;
		vi.mocked(computeVehicleJourneys).mockImplementation(async (source) => {
			if (source === failing) {
				failingCalls += 1;
				throw failingCalls % 2 === 0 ? new DeadlineExceededError() : new Error("broken feed");
			}
			return { journeys: [journeyOf(source)], paths: {}, withdrawnJourneyIds: [] };
		});
		const { context, published } = makeContext([failing, healthy]);

		void runSourceLoop(failing, context);
		void runSourceLoop(healthy, context);

		await waitFor(() => failingCalls >= 4 && countOf(published, "healthy") >= 4);
		expect(countOf(published, "failing")).toBe(0);
	});

	it("signale une itération bloquée sans arrêter les autres sources", async () => {
		const stuck = makeSource("stuck");
		const healthy = makeSource("healthy");
		vi.mocked(computeVehicleJourneys).mockImplementation(async (source) =>
			source === stuck ? new Promise(() => {}) : { journeys: [journeyOf(source)], paths: {}, withdrawnJourneyIds: [] },
		);
		const onStuck = vi.fn();
		const { context, published } = makeContext([stuck, healthy], { onStuck, stuckAfterMs: 20 });

		void runSourceLoop(stuck, context);
		void runSourceLoop(healthy, context);

		await waitFor(() => countOf(published, "healthy") >= 3);
		await vi.waitFor(() => expect(onStuck).toHaveBeenCalledWith(stuck));
	});

	it("ne republie l'inventaire que de la source à resynchroniser", async () => {
		const first = makeSource("first");
		const second = makeSource("second");
		const { context, published } = makeContext([first, second]);

		void runSourceLoop(first, context);
		void runSourceLoop(second, context);
		await waitFor(() => countOf(published, "first") >= 1 && countOf(published, "second") >= 1);

		vi.mocked(publishStopAreas).mockClear();
		context.resync.add("first");
		await waitFor(() => !context.resync.has("first"));

		const republished = vi.mocked(publishStopAreas).mock.calls.map(([, , sources]) => sources.map(({ id }) => id));
		expect(republished).toEqual([["first"]]);
	});
});
