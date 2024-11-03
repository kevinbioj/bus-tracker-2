/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "tours",
		staticResourceHref:
			"https://data.tours-metropole.fr/api/v2/catalog/datasets/horaires-temps-reel-gtfsrt-reseau-filbleu-tmvl/alternative_exports/filbleu_gtfszip",
		realtimeResourceHrefs: [
			"https://data.filbleu.fr/ws-tr/gtfs-rt/opendata/trip-updates",
			"https://data.filbleu.fr/ws-tr/gtfs-rt/opendata/vehicle-positions",
		],
		excludeScheduled: true,
		getNetworkRef: () => "FILBLEU",
	},
];

/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
	computeDelayMs: 10_000,
	redisOptions: {
		url: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
		username: process.env.REDIS_USERNAME,
		password: process.env.REDIS_PASSWORD,
	},
	sources,
};

export default configuration;
