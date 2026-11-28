import { beforeEach, describe, expect, it, vi } from "vitest";

import { computeNearbyDepartures } from "./nearby-departures-service.js";
import type { StopArea } from "./stop-area-service.js";
import { loadStopBoard, type ResolvedDeparture, type StopBoard } from "./stop-board-service.js";

vi.mock("./stop-area-service.js", () => ({ findStopAreasWithin: vi.fn(async () => stopAreas) }));
vi.mock("./stop-board-service.js", () => ({ DEPARTURES_LIMIT: 15, loadStopBoard: vi.fn() }));

const METERS_PER_DEGREE = 111_195;
const NOW = Date.parse("2026-11-28T09:00:00Z");
const origin = { latitude: 0, longitude: 0 };

let stopAreas: StopArea[] = [];
const boards = new Map<string, ResolvedDeparture[]>();

const inMinutes = (minutes: number) => new Date(NOW + minutes * 60_000).toISOString();

function stopAreaAt(id: string, meters: number): StopArea {
	return {
		ref: `NET:StopArea:${id}`,
		name: id,
		latitude: meters / METERS_PER_DEGREE,
		longitude: 0,
		networkRef: "NET",
		stopRefs: [`NET:StopPoint:${id}`],
		providerId: "provider",
		sourceId: "source",
		lineRefs: [],
		updatedAt: "2026-11-28",
		networkId: 1,
		networkIds: [1],
	};
}

function departure(stopId: string, minutes: number, journey: string): ResolvedDeparture {
	return {
		stopRef: `NET:StopPoint:${stopId}`,
		stopName: stopId,
		lineId: 1,
		lineNetworkId: 1,
		aimedTime: inMinutes(minutes),
		callStatus: "SCHEDULED",
		journeyRef: `NET:ServiceJourney:${journey}`,
		serviceDate: "2026-11-28",
		tracked: false,
		atStop: false,
	};
}

function withStops(...entries: [StopArea, ResolvedDeparture[]][]) {
	stopAreas = entries.map(([stopArea]) => stopArea);
	for (const [stopArea, departures] of entries) boards.set(stopArea.ref, departures);
}

const summarize = (payload: Awaited<ReturnType<typeof computeNearbyDepartures>>) =>
	payload.departures.map(({ stopAreaName, aimedTime }) => ({
		stop: stopAreaName,
		minutes: (Date.parse(aimedTime) - NOW) / 60_000,
	}));

describe("computeNearbyDepartures", () => {
	beforeEach(() => {
		boards.clear();
		vi.mocked(loadStopBoard).mockReset();
		vi.mocked(loadStopBoard).mockImplementation(async (ref) => {
			const stopArea = stopAreas.find((candidate) => candidate.ref === ref)!;
			return { board: { stopArea, departures: boards.get(ref) ?? [] } as unknown as StopBoard };
		});
	});

	it("écarte un passage imminent trop loin pour être attrapé à pied", async () => {
		withStops(
			[stopAreaAt("near", 100), [departure("near", 6, "A")]],
			[stopAreaAt("far", 1_000), [departure("far", 3, "B")]],
		);

		expect(summarize(await computeNearbyDepartures(origin, NOW))).toEqual([{ stop: "near", minutes: 6 }]);
	});

	it("préfère un passage proche un peu plus tardif à un passage lointain plus tôt", async () => {
		withStops(
			[stopAreaAt("near", 200), [departure("near", 25, "A")]],
			[stopAreaAt("far", 800), [departure("far", 20, "B")]],
		);

		const stops = summarize(await computeNearbyDepartures(origin, NOW)).map(({ stop }) => stop);
		expect(stops).toEqual(["near", "far"]);
	});

	it("ne garde une course vue à plusieurs arrêts qu'à l'arrêt où elle est la plus intéressante", async () => {
		withStops(
			[stopAreaAt("near", 100), [departure("near", 12, "A")]],
			[stopAreaAt("next", 300), [departure("next", 8, "A")]],
		);

		expect(summarize(await computeNearbyDepartures(origin, NOW))).toEqual([{ stop: "next", minutes: 8 }]);
	});

	it("écarte passages supprimés et lignes inconnues", async () => {
		withStops([
			stopAreaAt("near", 100),
			[
				{ ...departure("near", 5, "A"), callStatus: "SKIPPED" },
				{ ...departure("near", 6, "B"), canceled: true },
				{ ...departure("near", 7, "C"), lineId: undefined },
				departure("near", 8, "D"),
			],
		]);

		expect(summarize(await computeNearbyDepartures(origin, NOW)).map(({ minutes }) => minutes)).toEqual([8]);
	});

	it("s'arrête dès que les arrêts plus lointains ne peuvent plus faire mieux, et limite à 15 passages", async () => {
		const near = stopAreaAt("near", 50);
		const nearDepartures = Array.from({ length: 14 }, (_, index) => departure("near", 2 + index, `N${index}`));
		const others = Array.from({ length: 10 }, (_, index) => stopAreaAt(`s${index}`, 2_000 + index * 500));
		withStops(
			[near, nearDepartures],
			[stopAreaAt("close", 150), [departure("close", 4, "C1"), departure("close", 5, "C2")]],
			...others.map((stopArea): [StopArea, ResolvedDeparture[]] => [
				stopArea,
				[departure(stopArea.name, 60, stopArea.name)],
			]),
		);

		const payload = await computeNearbyDepartures(origin, NOW);

		expect(payload.departures).toHaveLength(15);
		expect(vi.mocked(loadStopBoard).mock.calls.length).toBeLessThanOrEqual(8);
		expect(payload.departures[0]).toMatchObject({ stopAreaRef: near.ref, distance: 50 });
		expect(payload.departures[0]).not.toHaveProperty("journeyRef");
	});

	it("n'affiche pas un passage moins intéressant que ceux qu'un tableau complet a tronqués", async () => {
		const busy = Array.from({ length: 15 }, (_, index) => departure("busy", 2 + index, `B${index}`));
		withStops([stopAreaAt("busy", 100), busy], [stopAreaAt("quiet", 400), [departure("quiet", 50, "Q")]]);

		const stops = summarize(await computeNearbyDepartures(origin, NOW)).map(({ stop }) => stop);
		expect(stops).not.toContain("quiet");
	});
});
