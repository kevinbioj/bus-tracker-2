/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
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
	{
		id: "pays-or",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/bbbd5a29-2fbf-47ae-84fd-6d1ebb758eeb",
		realtimeResourceHrefs: [
			"https://proxy.transport.data.gouv.fr/resource/transpor-gtfs-rt-trip-update",
			"https://proxy.transport.data.gouv.fr/resource/transpor-gtfs-rt-vehicle-position",
		],
		mode: "NO-TU",
		getNetworkRef: () => "TRANSPOR",
		getDestination: (journey) => journey?.calls.at(-1)?.stop.name,
		getVehicleRef: (vehicleDescriptor) => vehicleDescriptor?.label?.replaceAll(" ", ""),
	},
	// {
	// 	id: "perpignan",
	// 	staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/2afffa1f-aa4a-4fe4-9802-4b5f82bb96c6",
	// 	realtimeResourceHrefs: [],
	// 	getNetworkRef: () => "SANKEO",
	// },
	{
		id: "sete",
		staticResourceHref: "https://drive.google.com/uc?export=download&id=1JPmGimO4tfQpzL8A0ixYnYrPDehYILWn",
		realtimeResourceHrefs: [
			"https://sete.ceccli.com/gtfs/TripUpdates.pb",
			"https://sete.ceccli.com/gtfs/VehiclePositions.pb",
		],
		mode: "NO-TU",
		getNetworkRef: () => "SAM",
	},
	{
		id: "toulouse",
		staticResourceHref:
			"https://transport-data-gouv-fr-resource-history-prod.cellar-c2.services.clever-cloud.com/81678/81678.20241111.061207.408753.zip",
		realtimeResourceHrefs: [],
		mapLineRef: (lineRef) => lineRef.slice(4),
		mapStopRef: (stopRef) => stopRef.slice(stopRef.indexOf(":") + 1),
		getNetworkRef: () => "TISSEO",
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
