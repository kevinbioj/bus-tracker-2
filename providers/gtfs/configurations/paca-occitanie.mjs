/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	// {
	// 	id: "aix-marseille",
	// 	staticResourceHref:
	// 		"https://app.mecatran.com/utw/ws/gtfsfeed/static/mamp?apiKey=60327e505a214c77303f52206f11483069257343",
	// 	realtimeResourceHrefs: [],
	// 	gtfsOptions: { filterTrips: (trip) => !trip.route.id.startsWith("TER") && !trip.route.id.startsWith("LER") },
	// 	getNetworkRef: () => "LMM",
	// },
	{
		id: "avigon",
		staticResourceHref: "https://exs.tcra2.cityway.fr/gtfs.aspx?key=UID&operatorCode=TCRA",
		realtimeResourceHrefs: ["https://export.tcra2.cityway.fr/GtfsRt/GtfsRT.TCRA.pb"],
		excludeScheduled: true,
		getNetworkRef: () => "ORIZO",
	},
	{
		id: "cannes",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/47bc8088-6c72-43ad-a959-a5bbdd1aa14f",
		realtimeResourceHrefs: [
			"https://proxy.transport.data.gouv.fr/resource/palmbus-cannes-gtfs-rt-vehicle-position",
			"https://proxy.transport.data.gouv.fr/resource/palmbus-cannes-gtfs-rt-trip-update",
		],
		excludeScheduled: true,
		getNetworkRef: () => "PALMBUS",
	},
	{
		id: "montpellier",
		staticResourceHref: "https://data.montpellier3m.fr/TAM_MMM_GTFSRT/GTFS.zip",
		realtimeResourceHrefs: [
			"https://data.montpellier3m.fr/TAM_MMM_GTFSRT/TripUpdate.pb",
			"https://data.montpellier3m.fr/TAM_MMM_GTFSRT/VehiclePosition.pb",
		],
		mode: "NO-TU",
		excludeScheduled: true,
		getNetworkRef: () => "TAM",
	},
	// {
	// 	id: "nice",
	// 	staticResourceHref: "https://transport.data.gouv.fr/resources/79642/download",
	// 	realtimeResourceHrefs: [],
	// 	getNetworkRef: () => "LIGNES-AZUR",
	// },
	{
		id: "nimes",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/9f5fa77b-30b7-4520-a17c-db2122339612",
		realtimeResourceHrefs: [
			"https://transport.data.gouv.fr/resources/80732/download",
			"https://transport.data.gouv.fr/resources/80731/download",
		],
		mode: "NO-TU",
		getNetworkRef: () => "TANGO",
	},
	// {
	// 	id: "perpignan",
	// 	staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/2afffa1f-aa4a-4fe4-9802-4b5f82bb96c6",
	// 	realtimeResourceHrefs: [],
	// 	getNetworkRef: () => "SANKEO",
	// },
	// {
	// 	id: "toulouse",
	// 	staticResourceHref:
	// 		"https://transport-data-gouv-fr-resource-history-prod.cellar-c2.services.clever-cloud.com/81678/81678.20241111.061207.408753.zip",
	// 	realtimeResourceHrefs: [],
	// 	mapLineRef: (lineRef) => lineRef.slice(4),
	// 	mapStopRef: (stopRef) => stopRef.slice(stopRef.indexOf(":") + 1),
	// 	getNetworkRef: () => "TISSEO",
	// },
	{
		id: "zou-proximite",
		staticResourceHref: "https://www.datasud.fr/fr/dataset/datasets/3745/resource/5016/download/",
		realtimeResourceHrefs: [
			"https://proxy.transport.data.gouv.fr/resource/region-sud-zou-proximite-gtfs-rt-trip-update",
		],
		getNetworkRef: () => "ZOU",
		getVehicleRef: (descriptor) => +descriptor?.label || undefined,
	},
	{
		id: "zou-express",
		staticResourceHref: "https://www.datasud.fr/fr/dataset/datasets/3743/resource/5153/download/",
		realtimeResourceHrefs: ["https://proxy.transport.data.gouv.fr/resource/region-sud-zou-express-gtfs-rt-trip-update"],
		getNetworkRef: () => "ZOU",
		getVehicleRef: (descriptor) => +descriptor?.label || undefined,
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
