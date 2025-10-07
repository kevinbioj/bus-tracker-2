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
	["887490002", "0066"],
	["30020052", "0067"],
	["222640001", "0068"],
	["886400002", "0483"],
	["218410002", "0487"],
	["214760001", "0488"],
	["240420002", "0529"],
	["226790001", "0821"],
	["258800001", "0822"],
]);

const saclayZenbusIdToVehicleLabel = new Map();

/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	// {
	// 	id: "idfm",
	// 	staticResourceHref: "https://clarifygdps.com/bridge/gtfs/fr-idf.zip",
	// 	realtimeResourceHrefs: [
	// 		"http://gtfsidfm.clarifygdps.com/gtfs-rt-trips-idfm",
	// 		"https://gtfs.bus-tracker.fr/gtfs-rt/idfm/trip-updates",
	// 	],
	// 	gtfsOptions: {
	// 		filterTrips: (trip) => trip.route.name !== "TER",
	// 	},
	// 	excludeScheduled: true,
	// 	mapTripUpdate: (tripUpdate) => {
	// 		if (typeof tripUpdate.vehicle?.id === "string") {
	// 			delete tripUpdate.vehicle.id;
	// 		}
	// 		return tripUpdate;
	// 	},
	// 	isValidJourney: (journey) => {
	// 		const firstCall = journey.calls[0];
	// 		if (typeof firstCall === "undefined" || typeof firstCall.expectedTime === "undefined") return true;
	// 		return Temporal.Instant.from(firstCall.expectedTime).since(firstCall.aimedTime).total("minutes") < 1380;
	// 	},
	// 	getAheadTime: (journey) => (journey.trip?.route.type === "RAIL" ? 5 * 60 : 60),
	// 	getNetworkRef: () => "IDFM",
	// 	getVehicleRef: () => undefined,
	// },
	{
		id: "idfm",
		staticResourceHref: "https://gtfs.bus-tracker.fr/idfm.zip",
		realtimeResourceHrefs: ["https://gtfs.bus-tracker.fr/gtfs-rt/idfm/trip-updates"],
		gtfsOptions: {
			filterTrips: (trip) => trip.route.name !== "TER" && ["RAIL"].includes(trip.route.type),
		},
		isValidJourney: (journey) => {
			const firstCall = journey.calls[0];
			if (typeof firstCall === "undefined" || typeof firstCall.expectedTime === "undefined") return true;
			return Temporal.Instant.from(firstCall.expectedTime).since(firstCall.aimedTime).total("minutes") < 1380;
		},
		getAheadTime: (journey) => (journey.trip?.route.type === "RAIL" ? 5 * 60 : 60),
		getNetworkRef: () => "IDFM",
		getVehicleRef: () => undefined,
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
	{
		id: "saclay",
		staticResourceHref: "https://zenbus.net/gtfs/static/download.zip?dataset=caee",
		realtimeResourceHrefs: ["https://zenbus.net/gtfs/rt/poll.proto?dataset=caee"],
		mode: "NO-TU",
		excludeScheduled: true,
		getNetworkRef: () => "IDFM",
		getOperatorRef: () => "SACLAY",
		getVehicleRef: (vehicle) =>
			vehicle
				? saclayZenbusIdToVehicleLabel.get(
						vehicle.id.slice(nthIndexOf(vehicle.id, ":", 2) + 1, nthIndexOf(vehicle.id, ":", 3)),
					)
				: undefined,
		mapLineRef: (lineRef) => lineRef.slice(nthIndexOf(lineRef, ":", 2) + 1, nthIndexOf(lineRef, ":", 3)),
		mapStopRef: (stopRef) => stopRef.slice(nthIndexOf(stopRef, ":", 3) + 1, nthIndexOf(stopRef, ":", 4)),
	},
	{
		id: "clichy",
		staticResourceHref: "https://pysae.com/api/v2/groups/clichy/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/clichy/gtfs-rt"],
		mode: "NO-TU",
		excludeScheduled: true,
		mapLineRef: (lineRef) => `CLICHY-${lineRef}`,
		getNetworkRef: () => "IDFM",
		getOperatorRef: () => "CLICHY",
		getVehicleRef: (vehicle) => (vehicle ? vehicle.label : undefined),
	},
];

/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
	computeDelayMs: 30_000,
	redisOptions: {
		url: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
		username: process.env.REDIS_USERNAME,
		password: process.env.REDIS_PASSWORD,
	},
	sources,
};

export default configuration;
