/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "turin",
		staticResourceHref: "https://www.gtt.to.it/open_data/gtt_gtfs.zip",
		realtimeResourceHrefs: [
			"https://percorsieorari.gtt.to.it/das_gtfsrt/trip_updates.aspx",
			"https://percorsieorari.gtt.to.it/das_gtfsrt/vehicle_position.aspx",
		],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: () => "TURIN",
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
