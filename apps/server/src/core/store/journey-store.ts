import type { DisposeableVehicleJourney } from "../../types/disposeable-vehicle-journey.js";
import { createStringPool } from "../../utils/string-pool.js";

export const journeyStore = new Map<string, DisposeableVehicleJourney>();

setInterval(() => {
	const now = Temporal.Now.instant();
	let sweptJourneys = 0;
	for (const [key, journey] of journeyStore) {
		let shouldDelete = false;

		if (journey.position.type === "GPS") {
			const lastCall = journey.calls?.at(-1);
			shouldDelete =
				(lastCall === undefined || now.since(lastCall.expectedTime ?? lastCall.aimedTime).total("minutes") >= 5) &&
				now.since(journey.position.recordedAt).total("minutes") >= 10;
		} else {
			shouldDelete = now.since(journey.updatedAt).total("minutes") >= 2;
		}

		if (shouldDelete) {
			journeyStore.delete(key);
			sweptJourneys += 1;
		}
	}
	console.log("► Swept %d outdated vehicle journeys.", sweptJourneys);
}, 60_000);

export type JourneyStore = typeof journeyStore;

const strings = createStringPool();

/**
 * Range les courses reçues du worker. Le clone structuré qui les transporte recrée chacune de leurs
 * chaînes : celles qui se répètent d'une course à l'autre (arrêts, destinations, statuts) sont
 * ramenées à une instance partagée avant d'être conservées.
 */
export function storeJourneys(journeys: DisposeableVehicleJourney[]) {
	for (const journey of journeys) {
		journey.countryCode = strings.intern(journey.countryCode);
		journey.direction = strings.intern(journey.direction);
		journey.destination = strings.intern(journey.destination);
		journey.serviceDate = strings.intern(journey.serviceDate);
		journey.missionCode = strings.intern(journey.missionCode);
		journey.position.type = strings.intern(journey.position.type);
		for (const call of journey.calls ?? []) {
			call.stopRef = strings.intern(call.stopRef);
			call.stopName = strings.intern(call.stopName);
			call.platformName = strings.intern(call.platformName);
			call.callStatus = strings.intern(call.callStatus);
		}
		journeyStore.set(journey.id, journey);
		recordLineSighting(journey);
	}
}

/**
 * Délai pendant lequel un véhicule reste en ligne sur la dernière ligne où il a été vu, y compris s'il
 * circule depuis sans ligne (haut-le-pied, ligne inconnue) ou n'est plus publié.
 */
const ONLINE_SIGHTING_MAX_AGE_MS = 10 * 60_000;

/**
 * Dernière ligne où chaque véhicule a été vu, et l'instant de la position qui l'y montrait. C'est ce
 * que disait `line_activity.updated_at`, que les routes n'interrogent plus : il n'est plus indexé, et
 * cette mémoire n'ajoute aucune requête.
 */
const lineSightings = new Map<number, { lineId: number; recordedAtMs: number }>();

function recordLineSighting(journey: DisposeableVehicleJourney) {
	const vehicleId = journey.vehicle?.id;
	if (vehicleId === undefined || journey.lineId === undefined) return;

	const recordedAtMs = Date.parse(journey.position.recordedAt);
	const known = lineSightings.get(vehicleId);
	if (known === undefined || recordedAtMs >= known.recordedAtMs) {
		lineSightings.set(vehicleId, { lineId: journey.lineId, recordedAtMs });
	}
}

setInterval(() => {
	const nowMs = Date.now();
	for (const [vehicleId, { recordedAtMs }] of lineSightings) {
		if (nowMs - recordedAtMs >= ONLINE_SIGHTING_MAX_AGE_MS) lineSightings.delete(vehicleId);
	}
}, 60_000).unref();

/** Ligne sur laquelle le véhicule est en ligne, ou `undefined` s'il ne l'est pas. */
export function findOnlineLineId(vehicleId: number, nowMs = Date.now()) {
	const sighting = lineSightings.get(vehicleId);
	if (sighting === undefined || nowMs - sighting.recordedAtMs >= ONLINE_SIGHTING_MAX_AGE_MS) return undefined;
	return sighting.lineId;
}

/**
 * Course de chaque véhicule suivi. Un véhicule publié sous deux clés à la fois (le temps qu'une
 * source bascule de l'une à l'autre) est rattaché à sa position la plus récente.
 */
export function findJourneysByVehicleId() {
	const journeys = new Map<number, DisposeableVehicleJourney>();
	for (const journey of journeyStore.values()) {
		const vehicleId = journey.vehicle?.id;
		if (vehicleId === undefined) continue;

		const known = journeys.get(vehicleId);
		if (known === undefined || Date.parse(journey.position.recordedAt) > Date.parse(known.position.recordedAt)) {
			journeys.set(vehicleId, journey);
		}
	}
	return journeys;
}
