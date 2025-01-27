import { Temporal } from "temporal-polyfill";

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
			return Temporal.Instant.from(firstCall.expectedTime).since(firstCall.aimedTime).total("minutes") < 1440;
		},
		getNetworkRef: () => "IDFM",
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
