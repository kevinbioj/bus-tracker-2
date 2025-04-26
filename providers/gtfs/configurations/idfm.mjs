import { Temporal } from "temporal-polyfill";

function nthIndexOf(input, pattern, n) {
	const length = input.length;
	let i = -1;
	let j = n;
	while (j-- && i++ < length) {
		i = input.indexOf(pattern, i);
		if (i < 0) break;
	}
	return i;
}

const gpsoZenbusIdToVehicleLabel = new Map([
	["222640001", "0068"],
	["886400002", "0483"],
	["218410002", "0487"],
	["214760001", "0488"],
	["226790001", "0821"],
]);

/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "idfm",
		staticResourceHref: "https://gtfs.bus-tracker.fr/idfm.zip",
		realtimeResourceHrefs: ["https://gtfs.bus-tracker.fr/gtfs-rt/idfm/trip-updates"],
		gtfsOptions: {
			filterTrips: (trip) => trip.route.name !== "TER" && trip.route.type !== "BUS" && trip.route.type !== "UNKNOWN",
		},
		isValidJourney: (journey) => {
			const firstCall = journey.calls[0];
			if (typeof firstCall === "undefined" || typeof firstCall.expectedTime === "undefined") return true;
			return Temporal.Instant.from(firstCall.expectedTime).since(firstCall.aimedTime).total("minutes") < 1380;
		},
		getAheadTime: (journey) => (journey.trip?.route.type === "RAIL" ? 5 * 60 : 60),
		getNetworkRef: () => "IDFM",
	},
	{
		id: "gpso",
		staticResourceHref: "https://zenbus.net/gtfs/static/download.zip?dataset=gpso-rt",
		realtimeResourceHrefs: ["https://zenbus.net/gtfs/rt/poll.proto?dataset=gpso-rt"],
		mode: "NO-TU",
		excludeScheduled: true,
		getNetworkRef: () => "IDFM",
		getOperatorRef: () => "GPSO",
		getVehicleRef: (vehicle) =>
			vehicle
				? gpsoZenbusIdToVehicleLabel.get(
						vehicle.id.slice(nthIndexOf(vehicle.id, ":", 2) + 1, nthIndexOf(vehicle.id, ":", 3)),
					)
				: undefined,
		mapLineRef: (lineRef) => lineRef.slice(nthIndexOf(lineRef, ":", 2) + 1, nthIndexOf(lineRef, ":", 3)),
		mapStopRef: (stopRef) => stopRef.slice(nthIndexOf(stopRef, ":", 3) + 1, nthIndexOf(stopRef, ":", 4)),
	},
];

/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
	computeDelayMs: 20_000,
	redisOptions: {
		url: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
		username: process.env.REDIS_USERNAME,
		password: process.env.REDIS_PASSWORD,
	},
	sources,
};

export default configuration;
