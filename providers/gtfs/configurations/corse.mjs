/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "porto-vecchio",
		staticResourceHref: "https://pysae.com/api/v2/groups/porto-vecchio/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/porto-vecchio/gtfs-rt"],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		mode: "NO-TU",
		excludeScheduled: true,
		getNetworkRef: () => "A-CITADINA",
		getVehicleRef: (vehicle) => vehicle?.label,
	},
];

/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
	computeDelayMs: 15_000,
	redisOptions: {
		url: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
		username: process.env.REDIS_USERNAME,
		password: process.env.REDIS_PASSWORD,
	},
	sources,
};

export default configuration;
