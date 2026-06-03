import { XMLParser } from "fast-xml-parser";

export const GTFS_RT_TRIP_UPDATES_URL = "https://proxy.transport.data.gouv.fr/resource/sncf-gtfs-rt-trip-updates";
export const SIRI_LITE_ESTIMATED_TIMETABLE_URL =
	"https://proxy.transport.data.gouv.fr/resource/sncf-siri-lite-estimated-timetable";
export const SIRI_LITE_REFRESH_INTERVAL_MS = 60_000;

const parser = new XMLParser({
	htmlEntities: true,
	removeNSPrefix: true,
});

export let siriLiteJourneysByTrainNumber = new Map();

let siriLiteRefreshInProgress = false;

export function asArray(value) {
	if (value === undefined || value === null) return [];
	return Array.isArray(value) ? value : [value];
}

export function normalizeSncfStopRef(stopRef) {
	const serializedStopRef = String(stopRef);

	if (serializedStopRef.startsWith("FR:ScheduledStopPoint::")) {
		return serializedStopRef.slice("FR:ScheduledStopPoint::".length);
	}

	if (serializedStopRef.startsWith("SNCF:StopPoint:")) {
		return serializedStopRef.slice("SNCF:StopPoint:".length);
	}

	return serializedStopRef.split(":").at(-1);
}

export function getSiriLiteEstimatedVehicleJourneys(payload) {
	return asArray(payload.Siri?.ServiceDelivery).flatMap((serviceDelivery) =>
		asArray(serviceDelivery.EstimatedTimetableDelivery).flatMap((delivery) =>
			asArray(delivery.EstimatedJourneyVersionFrame).flatMap((frame) => asArray(frame.EstimatedVehicleJourney)),
		),
	);
}

export function getSiriLiteTrainNumbers(journey) {
	return asArray(journey.TrainNumbers?.TrainNumberRef)
		.map((trainNumber) => String(trainNumber))
		.filter((trainNumber) => trainNumber.length > 0);
}

export function getSiriLiteCalls(journey) {
	return [...asArray(journey.RecordedCalls?.RecordedCall), ...asArray(journey.EstimatedCalls?.EstimatedCall)].sort(
		(a, b) => Number(a.Order ?? 0) - Number(b.Order ?? 0),
	);
}

export function createSiriLiteJourneyMap(payload) {
	const journeysByTrainNumber = new Map();

	for (const journey of getSiriLiteEstimatedVehicleJourneys(payload)) {
		for (const trainNumber of getSiriLiteTrainNumbers(journey)) {
			journeysByTrainNumber.set(trainNumber, journey);
		}
	}

	return journeysByTrainNumber;
}

function getTrainNumberFromVehicleJourney(vehicleJourney) {
	return vehicleJourney.vehicleRef?.match(/:Vehicle:(.+)$/)?.[1];
}

export function enrichSncfJourneyWithSiriLitePlatforms(vehicleJourney, siriLiteJourney) {
	if (vehicleJourney.calls === undefined) return;

	const siriLiteCallsByStopRef = new Map();
	for (const call of getSiriLiteCalls(siriLiteJourney)) {
		if (call.StopPointRef === undefined || call.ArrivalPlatformName === undefined) continue;

		const stopRef = normalizeSncfStopRef(call.StopPointRef);
		if (stopRef === undefined || siriLiteCallsByStopRef.has(stopRef)) continue;

		siriLiteCallsByStopRef.set(stopRef, String(call.ArrivalPlatformName));
	}

	for (const call of vehicleJourney.calls) {
		const platformName = siriLiteCallsByStopRef.get(normalizeSncfStopRef(call.stopRef));
		if (platformName !== undefined && platformName.length > 0) {
			call.platformName = platformName;
		}
	}
}

export function enrichSncfJourneyWithSiriLitePlatformsByTrainNumber(vehicleJourney) {
	const trainNumber = getTrainNumberFromVehicleJourney(vehicleJourney);
	if (trainNumber === undefined) return true;

	const siriLiteJourney = siriLiteJourneysByTrainNumber.get(trainNumber);
	if (siriLiteJourney === undefined) return true;

	enrichSncfJourneyWithSiriLitePlatforms(vehicleJourney, siriLiteJourney);
	return true;
}

export async function refreshSiriLiteJourneys() {
	if (siriLiteRefreshInProgress) return;

	siriLiteRefreshInProgress = true;
	try {
		const response = await fetch(SIRI_LITE_ESTIMATED_TIMETABLE_URL, {
			signal: AbortSignal.timeout(15_000),
		});

		if (!response.ok) {
			throw new Error(`Failed to download SNCF SIRI Lite feed (status ${response.status}).`);
		}

		const contentType = response.headers.get("content-type") ?? "";
		if (!contentType.includes("xml")) {
			throw new Error(`SNCF SIRI Lite feed returned '${contentType}' instead of XML.`);
		}

		siriLiteJourneysByTrainNumber = createSiriLiteJourneyMap(parser.parse(await response.text()));
	} catch (error) {
		console.error("Failed to refresh SNCF SIRI Lite journeys.", error);
	} finally {
		siriLiteRefreshInProgress = false;
	}
}

function startSiriLiteJourneyPolling() {
	refreshSiriLiteJourneys();
	setInterval(refreshSiriLiteJourneys, SIRI_LITE_REFRESH_INTERVAL_MS);
}

if (process.env.NODE_ENV !== "test") {
	startSiriLiteJourneyPolling();
}

/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "sncf",
		staticResourceHref: "https://gtfs.bus-tracker.fr/sncf.zip",
		realtimeResourceHrefs: [GTFS_RT_TRIP_UPDATES_URL],
		excludeScheduled: true,
		gtfsOptions: { ignoreBlocks: true },
		getAheadTime: () => 10 * 60,
		getNetworkRef: () => "SNCF",
		getVehicleRef: (_, journey) => journey?.trip.headsign,
		getDestination: (journey) => journey?.calls.findLast((call) => call.status !== "SKIPPED")?.stop.name,
		mapStopRef: (stopRef) => {
			if (stopRef.startsWith("StopArea:OCE")) {
				return stopRef.slice("StopArea:OCE".length);
			}

			return stopRef.split("-")[1];
		},
		isValidJourney: enrichSncfJourneyWithSiriLitePlatformsByTrainNumber,
	},
];

/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
	id: "sncf",
	computeDelayMs: 10_000,
	sources,
};

export default configuration;
