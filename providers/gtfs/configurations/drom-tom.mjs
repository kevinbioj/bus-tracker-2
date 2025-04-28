/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "car-jaune",
		staticResourceHref: "https://pysae.com/api/v2/groups/car-jaune/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/car-jaune/gtfs-rt"],
		mode: "NO-TU",
		excludeScheduled: true,
		getNetworkRef: () => "CAR-JAUNE",
		getVehicleRef: (vehicle) => vehicle?.label,
	},
	{
		id: "karouest",
		staticResourceHref: "https://pysae.com/api/v2/semto-2/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/semto-2/gtfs-rt"],
		mode: "NO-TU",
		getNetworkRef: () => "KAROUEST",
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
