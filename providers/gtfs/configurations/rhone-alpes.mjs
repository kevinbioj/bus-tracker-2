/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "grenoble",
		staticResourceHref: "https://data.mobilites-m.fr/api/gtfs/SEM",
		realtimeResourceHrefs: [],
		getNetworkRef: () => "TAG",
	},
	{
		id: "st-etienne",
		staticResourceHref: "https://api.stas3.cityway.fr/dataflow/offre-tc/download?provider=STAS&dataFormat=GTFS",
		realtimeResourceHrefs: [
			"https://api.stas3.cityway.fr/dataflow/horaire-tc-tr/download?provider=STAS&dataFormat=GTFS-RT",
			"https://api.stas3.cityway.fr/dataflow/vehicule-tc-tr/download?provider=STAS&dataFormat=GTFS-RT",
		],
		mode: "NO-TU",
		getNetworkRef: () => "STAS",
		getDestination: (journey) => journey?.calls.findLast((call) => call.status !== "SKIPPED")?.stop.name,
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
