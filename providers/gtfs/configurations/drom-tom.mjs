/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "alterneo",
		staticResourceHref: "https://transport.data.gouv.fr/resources/80676/download",
		realtimeResourceHrefs: [
			"https://proxy.transport.data.gouv.fr/resource/alterneo-civis-gtfs-rt-trip-update",
			"https://proxy.transport.data.gouv.fr/resource/alterneo-civis-gtfs-rt-vehicle-position",
		],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		mode: "NO-TU",
		excludeScheduled: true,
		getNetworkRef: () => "ALTERNEO",
		getDestination: (journey) =>
			journey?.calls.findLast((call) => call.status !== "SKIPPED")?.stop.name ?? journey?.trip.headsign,
	},
	{
		id: "car-jaune",
		staticResourceHref: "https://pysae.com/api/v2/groups/car-jaune/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/car-jaune/gtfs-rt"],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		mode: "NO-TU",
		excludeScheduled: true,
		getNetworkRef: () => "CAR-JAUNE",
		getVehicleRef: (vehicle) => vehicle?.label,
	},
	{
		id: "citalis",
		staticResourceHref: "https://gtfs.bus-tracker.fr/citalis.zip",
		realtimeResourceHrefs: [],
		getNetworkRef: () => "CITALIS",
	},
	{
		id: "karouest",
		staticResourceHref: "https://pysae.com/api/v2/groups/semto-2/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/semto-2/gtfs-rt"],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		mode: "NO-TU",
		getNetworkRef: () => "KAROUEST",
		getDestination: (journey) => journey?.calls?.findLast((call) => call.status !== "SKIPPED")?.stop.name,
		getVehicleRef: (vehicle) => vehicle?.label,
	},
	{
		id: "sud-lib",
		staticResourceHref: "https://gtfs.bus-tracker.fr/sudlib.zip",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/sud_lib/gtfs-rt"],
		mode: "NO-TU",
		getNetworkRef: () => "SUD-LIB",
		getVehicleRef: (vehicle) => vehicle?.label,
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
