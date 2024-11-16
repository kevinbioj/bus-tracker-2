/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "angers",
		staticResourceHref: "https://chouette.enroute.mobi/api/v1/datas/Irigo/gtfs.zip",
		realtimeResourceHrefs: ["https://ara-api.enroute.mobi/irigo/gtfs/trip-updates"],
		gtfsOptions: {
			filterTrips: (trip) =>
				[
					"01",
					"02",
					"03",
					"04",
					"05",
					"06",
					"07",
					"08",
					"09",
					"10",
					"11",
					"12",
					"20",
					"21",
					"22",
					"23",
					"24",
					"25",
					"A",
					"B",
					"C",
					"NavM",
					"Tbus",
				].includes(trip.route.id),
		},
		getNetworkRef: () => "IRIGO",
	},
	{
		id: "angers-sub",
		staticResourceHref: "https://pysae.com/api/v2/groups/irigo/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/irigo/gtfs-rt"],
		getNetworkRef: () => "IRIGO",
		getVehicleRef: (descriptor) => descriptor?.label?.trim() || undefined,
	},
	{
		id: "nantes",
		staticResourceHref:
			"https://data.nantesmetropole.fr/explore/dataset/244400404_tan-arrets-horaires-circuits/files/16a1a0af5946619af621baa4ad9ee662/download/",
		realtimeResourceHrefs: [],
		getNetworkRef: () => "NAOLIB",
	},
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
	computeDelayMs: 30_000,
	redisOptions: {
		url: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
		username: process.env.REDIS_USERNAME,
		password: process.env.REDIS_PASSWORD,
	},
	sources,
};

export default configuration;