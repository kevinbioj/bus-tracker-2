/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "aubenas",
		staticResourceHref:
			"https://app.mecatran.com/utw/ws/gtfsfeed/static/aubenas?apiKey=6527571c533049035b6a0d41252853243b1f2a68",
		realtimeResourceHrefs: ["https://gtfs-rt.infra-hubup.fr/toutenbus/realtime"],
		excludeScheduled: true,
		getNetworkRef: () => "AUBENAS",
	},
	{
		id: "chamonix",
		staticResourceHref: "https://pysae.com/api/v2/groups/chamonix-bus/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/chamonix-bus/gtfs-rt"],
		mode: "NO-TU",
		excludeScheduled: true,
		getNetworkRef: () => "CHAMONIX",
		getVehicleRef: (vehicle) => vehicle?.label ?? undefined,
	},
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
