import { inArray } from "drizzle-orm";

import type { DisposeableVehicleJourney } from "../../types/disposeable-vehicle-journey.js";
import { type Coordinates, distanceMeters } from "../../utils/geo.js";
import { database } from "../database/database.js";
import { networksTable, vehiclesTable } from "../database/schema.js";
import { journeyStore } from "../store/journey-store.js";
import { findStopAreaOfStopPoint } from "./stop-area-service.js";

const MAX_POSITION_AGE_SECONDS = 90;
const MIN_UPCOMING_CALLS = 3;
const SHORTLIST_SIZE = 200;
const CACHE_TTL_MS = 30_000;
const MIN_STOP_LEAD_SECONDS = 90;
const MAX_STOP_CALLS = 4;
const MAX_STOP_JOURNEYS = 5;
const NEARBY_RADIUS_METERS = 10_000;

type AirConditioning = (typeof vehiclesTable.$inferSelect)["airConditioning"];

export function scoreShowcaseCandidate(journey: DisposeableVehicleJourney, now: Temporal.Instant) {
	if (journey.lineId === undefined) return undefined;
	if (now.since(journey.position.recordedAt).total("seconds") > MAX_POSITION_AGE_SECONDS) return undefined;

	const upcomingCalls = journey.calls?.filter((call) => call.callStatus !== "SKIPPED") ?? [];
	if (upcomingCalls.length < MIN_UPCOMING_CALLS) return undefined;

	let score = 0;
	if (journey.position.type === "GPS") score += 4;
	if (journey.vehicle !== undefined) score += 1;
	if (journey.occupancy !== undefined) score += 3;
	if (upcomingCalls.some((call) => call.expectedTime !== undefined)) score += 1;
	if (journey.wheelchairAccessible !== undefined) score += 1;
	if (journey.bikesAllowed !== undefined) score += 1;
	return score;
}

export function scoreShowcaseDetails(details: {
	airConditioning: AirConditioning | undefined;
	hasNetworkLogo: boolean;
}) {
	let score = 0;
	if (details.airConditioning === "PRESENT" || details.airConditioning === "OUT_OF_SERVICE") score += 3;
	if (details.hasNetworkLogo) score += 2;
	return score;
}

export function pickUpcomingCalls(journey: DisposeableVehicleJourney, now: Temporal.Instant) {
	const earliest = now.add({ seconds: MIN_STOP_LEAD_SECONDS });
	return (journey.calls ?? [])
		.filter(
			(call) =>
				call.callStatus !== "SKIPPED" &&
				Temporal.Instant.compare(Temporal.Instant.from(call.expectedTime ?? call.aimedTime), earliest) >= 0,
		)
		.slice(0, MAX_STOP_CALLS);
}

export type ShowcaseStop = { ref: string; latitude: number; longitude: number };

async function findShowcaseStop(journey: DisposeableVehicleJourney, now: Temporal.Instant) {
	for (const call of pickUpcomingCalls(journey, now)) {
		const stopArea = await findStopAreaOfStopPoint(call.stopRef);
		if (stopArea !== undefined) {
			return { ref: stopArea.ref, latitude: stopArea.latitude, longitude: stopArea.longitude } satisfies ShowcaseStop;
		}
	}
	return undefined;
}

export const isNearShowcaseOrigin = (position: Coordinates, origin: Coordinates) =>
	distanceMeters(origin, position) <= NEARBY_RADIUS_METERS;

type Showcase = { journey: DisposeableVehicleJourney; stop: ShowcaseStop | undefined };

let cached: { journeyId: string; stop: ShowcaseStop | undefined; at: number } | undefined;

export async function findShowcase(near?: Coordinates) {
	if (near !== undefined) {
		const nearby = await pickShowcase(Temporal.Now.instant(), (journey) =>
			isNearShowcaseOrigin(journey.position, near),
		);
		if (nearby !== undefined) return nearby;
	}

	if (cached !== undefined && Date.now() - cached.at < CACHE_TTL_MS) {
		const journey = journeyStore.get(cached.journeyId);
		if (journey !== undefined) return { journey, stop: cached.stop };
	}

	const showcase = await pickShowcase(Temporal.Now.instant());
	if (showcase !== undefined) cached = { journeyId: showcase.journey.id, stop: showcase.stop, at: Date.now() };
	return showcase;
}

async function pickShowcase(
	now: Temporal.Instant,
	isEligible?: (journey: DisposeableVehicleJourney) => boolean,
): Promise<Showcase | undefined> {
	const ranked = await rankShowcaseJourneys(now, isEligible);
	if (ranked.length === 0) return undefined;

	let showcase: Showcase = {
		journey: ranked[0]!,
		stop: undefined,
	};
	for (const journey of ranked.slice(0, MAX_STOP_JOURNEYS)) {
		const stop = await findShowcaseStop(journey, now);
		if (stop !== undefined) {
			showcase = { journey, stop };
			break;
		}
	}
	return showcase;
}

async function rankShowcaseJourneys(
	now: Temporal.Instant,
	isEligible: (journey: DisposeableVehicleJourney) => boolean = () => true,
) {
	const shortlist = journeyStore
		.values()
		.filter(isEligible)
		.map((journey) => ({ journey, score: scoreShowcaseCandidate(journey, now) }))
		.filter(
			(candidate): candidate is { journey: DisposeableVehicleJourney; score: number } => candidate.score !== undefined,
		)
		.toArray()
		.sort((a, b) => b.score - a.score)
		.slice(0, SHORTLIST_SIZE);

	if (shortlist.length === 0) return [];

	const vehicleIds = shortlist.flatMap(({ journey }) =>
		journey.vehicle?.id !== undefined ? [journey.vehicle.id] : [],
	);
	const networkIds = [...new Set(shortlist.map(({ journey }) => journey.networkId))];

	const [vehicles, networks] = await Promise.all([
		database
			.select({ id: vehiclesTable.id, airConditioning: vehiclesTable.airConditioning })
			.from(vehiclesTable)
			.where(inArray(vehiclesTable.id, vehicleIds)),
		database
			.select({ id: networksTable.id, logoHref: networksTable.logoHref })
			.from(networksTable)
			.where(inArray(networksTable.id, networkIds)),
	]);

	const airConditioningByVehicleId = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle.airConditioning]));
	const networksWithLogo = new Set(
		networks.filter((network) => network.logoHref !== null).map((network) => network.id),
	);

	return shortlist
		.map(({ journey, score }) => ({
			journey,
			score:
				score +
				scoreShowcaseDetails({
					airConditioning:
						journey.vehicle?.id !== undefined
							? (airConditioningByVehicleId.get(journey.vehicle.id) ?? undefined)
							: undefined,
					hasNetworkLogo: networksWithLogo.has(journey.networkId),
				}),
		}))
		.sort((a, b) => b.score - a.score)
		.map(({ journey }) => journey);
}
