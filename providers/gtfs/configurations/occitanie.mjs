function nthIndexOf(input, pattern, n) {
	const length = input.length;
	let i = -1;
	let j = n;
	while (j-- && i++ < length) {
		i = input.indexOf(pattern, i);
		if (i < 0) break;
	}
	return i;
}

/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "airbus-tlz",
		staticResourceHref: "https://pysae.com/api/v2/groups/airbus-toulouse/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/airbus-toulouse/gtfs-rt"],
		mode: "NO-TU",
		excludeScheduled: true,
		getNetworkRef: () => "AIRBUS-TLZ",
		getVehicleRef: (vehicle) => vehicle?.label ?? undefined,
	},
	{
		id: "agde",
		staticResourceHref: "https://zenbus.net/gtfs/static/download.zip?dataset=agdecapbus68429531",
		realtimeResourceHrefs: ["https://zenbus.net/gtfs/rt/poll.proto?dataset=agdecapbus68429531"],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		mode: "VP-ONLY",
		excludeScheduled: true,
		getNetworkRef: () => "CAPBUS",
		getVehicleRef: () => undefined,
		mapLineRef: (lineRef) => lineRef.slice(nthIndexOf(lineRef, ":", 2) + 1, nthIndexOf(lineRef, ":", 3)),
		mapStopRef: (stopRef) => stopRef.slice(nthIndexOf(stopRef, ":", 3) + 1, nthIndexOf(stopRef, ":", 4)),
	},
	{
		id: "arles",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/52216d2f-072e-4b7d-af0c-15d8d4e98b09",
		realtimeResourceHrefs: [
			"https://accm.2cloud.app/api/gtfsrt/2.0/tripupdates/LUMIPLAN-2021-4815-1108/bin",
			"https://accm.2cloud.app/api/gtfsrt/2.0/vehiclepositions/LUMIPLAN-2021-4815-1108/bin",
		],
		mode: "NO-TU",
		excludeScheduled: true,
		getNetworkRef: () => "ENVIA",
	},
	{
		id: "castres",
		staticResourceHref: "https://zenbus.net/gtfs/static/download.zip?dataset=castreslignesurbaines",
		realtimeResourceHrefs: ["https://zenbus.net/gtfs/rt/poll.proto?dataset=castreslignesurbaines"],
		mode: "NO-TU",
		getNetworkRef: () => "LIBELLUS",
		getVehicleRef: () => undefined,
	},
	{
		id: "lio",
		staticResourceHref:
			"https://app.mecatran.com/utw/ws/gtfsfeed/static/lio?apiKey=2b160d626f783808095373766f18714901325e45&type=gtfs_lio",
		realtimeResourceHrefs: [],
		getNetworkRef: () => "LIO",
	},
	{
		id: "montpellier",
		staticResourceHref: "https://data.montpellier3m.fr/TAM_MMM_GTFSRT/GTFS.zip",
		realtimeResourceHrefs: [
			"https://data.montpellier3m.fr/TAM_MMM_GTFSRT/TripUpdate.pb",
			"https://data.montpellier3m.fr/TAM_MMM_GTFSRT/VehiclePosition.pb",
		],
		mode: "NO-TU",
		getNetworkRef: () => "TAM",
		mapLineRef: (lineRef) => lineRef.split("-")[1],
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
	{
		id: "perpignan",
		staticResourceHref:
			"https://eur.mecatran.com/utw/ws/gtfsfeed/static/perpignan?apiKey=612f606b5e3b0a3e6e1f441a2c4a050f6a345b55",
		realtimeResourceHrefs: [
			"https://eur.mecatran.com/utw/ws/gtfsfeed/vehicles/perpignan?apiKey=612f606b5e3b0a3e6e1f441a2c4a050f6a345b55",
			"https://eur.mecatran.com/utw/ws/gtfsfeed/realtime/perpignan?apiKey=612f606b5e3b0a3e6e1f441a2c4a050f6a345b55",
		],
		mode: "NO-TU",
		getNetworkRef: () => "SANKEO",
		getVehicleRef: (vehicle) => vehicle?.label ?? undefined,
	},
	{
		id: "sete",
		staticResourceHref: "https://sete.ceccli.com/gtfs/gtfs.zip",
		realtimeResourceHrefs: [
			"https://sete.ceccli.com/gtfs/TripUpdates.pb",
			"https://sete.ceccli.com/gtfs/VehiclePositions.pb",
		],
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: () => "SAM",
		mapVehiclePosition: (vehicle) => (vehicle.trip ? vehicle : undefined),
	},
	{
		id: "toulouse",
		staticResourceHref:
			"https://data.toulouse-metropole.fr/explore/dataset/tisseo-gtfs/files/fc1dda89077cf37e4f7521760e0ef4e9/download/",
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
