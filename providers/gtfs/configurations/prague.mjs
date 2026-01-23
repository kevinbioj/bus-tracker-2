/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "prague",
		staticResourceHref: "https://data.pid.cz/PID_GTFS.zip",
		realtimeResourceHrefs: ["https://api.golemio.cz/v2/vehiclepositions/gtfsrt/pid_feed.pb"],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: () => "PID",
		getVehicleRef: (vehicle) => vehicle?.label,
	},
];

/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
	computeDelayMs: 60_000,
	redisOptions: {
		url: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
		username: process.env.REDIS_USERNAME,
		password: process.env.REDIS_PASSWORD,
	},
	sources,
};

export default configuration;
