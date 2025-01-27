/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "idfm",
		staticResourceHref: "https://gtfs.bus-tracker.fr/idfm.zip",
		realtimeResourceHrefs: ["https://gtfs.bus-tracker.fr/gtfs-rt/idfm/trip-updates"],
		gtfsOptions: {
			filterTrips: (trip) => trip.route.name !== "TER" && trip.route.type !== "BUS" && trip.route.type !== "UNKNOWN",
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
