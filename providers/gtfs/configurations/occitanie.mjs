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

const agdeZenbusVehicles = new Map([
	["zenbus:Vehicle:318570002:LOC", "123036"],
	["zenbus:Vehicle:308550002:LOC", "153065"],
]);

/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "airbus-tlz",
		staticResourceHref: "https://pysae.com/api/v2/groups/airbus-toulouse/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/airbus-toulouse/gtfs-rt"],
		gtfsOptions: { shapesStrategy: "IGNORE" },
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
		getVehicleRef: (vehicle) => (vehicle?.id ? agdeZenbusVehicles.get(vehicle.id) : undefined),
		mapLineRef: (lineRef) => lineRef.slice(nthIndexOf(lineRef, ":", 2) + 1, nthIndexOf(lineRef, ":", 3)),
		mapStopRef: (stopRef) => stopRef.slice(nthIndexOf(stopRef, ":", 3) + 1, nthIndexOf(stopRef, ":", 4)),
	},
	{
		id: "ales",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/b9a0f32e-4386-454c-8759-b82653fa861e",
		realtimeResourceHrefs: [
			"https://alesy.plateforme-2cloud.com/api/gtfsrt/tripupdates/ALESY-6574-4401-7572/bin",
			"https://alesy.plateforme-2cloud.com/api/gtfsrt/vehiclepositions/ALESY-6574-4401-7572/bin",
		],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: () => "ALESY",
		getVehicleRef: (vehicle) => vehicle?.label,
	},
	{
		id: "arles",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/52216d2f-072e-4b7d-af0c-15d8d4e98b09",
		realtimeResourceHrefs: [
			"https://accm.2cloud.app/api/gtfsrt/2.0/tripupdates/LUMIPLAN-2021-4815-1108/bin",
			"https://accm.2cloud.app/api/gtfsrt/2.0/vehiclepositions/LUMIPLAN-2021-4815-1108/bin",
		],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		mode: "NO-TU",
		excludeScheduled: true,
		getNetworkRef: () => "ENVIA",
	},
	{
		id: "castres",
		staticResourceHref: "https://zenbus.net/gtfs/static/download.zip?dataset=castreslignesurbaines",
		realtimeResourceHrefs: ["https://zenbus.net/gtfs/rt/poll.proto?dataset=castreslignesurbaines"],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		mode: "NO-TU",
		excludeScheduled: true,
		getNetworkRef: () => "LIBELLUS",
		getVehicleRef: () => undefined,
	},
	{
		id: "lio-global",
		staticResourceHref:
			"https://app.mecatran.com/utw/ws/gtfsfeed/static/lio?apiKey=2b160d626f783808095373766f18714901325e45&type=gtfs_lio",
		realtimeResourceHrefs: [],
		excludeScheduled: (trip) =>
			![
				"101",
				"102",
				"103",
				"104",
				"105",
				"106",
				"108",
				"109",
				"110",
				"111",
				"112",
				"113",
				"115",
				"121",
				"122",
				"123",
				"132",
				"133",
				"134",
				"135",
				"136",
				"140",
				"141",
				"142",
				"152",
				"889",
				"890",
				"891",
			].includes(trip.route.id),
		getNetworkRef: () => "LIO",
	},
	{
		id: "lio-gard",
		staticResourceHref: "https://pysae.com/api/v2/groups/lio-gard/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/lio-gard/gtfs-rt"],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		excludeScheduled: true,
		mode: "NO-TU",
		mapLineRef: (lineRef) => lineRef.split("|")[0],
		getNetworkRef: () => "LIO",
		getVehicleRef: (vehicle) => {
			if (typeof vehicle?.label !== "string") return;
			if (vehicle.label.startsWith("LOT")) return;
			return vehicle.label;
		},
	},
	{
		id: "lio-gard-keolis",
		staticResourceHref: "https://pysae.com/api/v2/groups/lio-gard-keolis/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/lio-gard-keolis/gtfs-rt"],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: () => "LIO",
		getVehicleRef: (vehicle) => {
			if (typeof vehicle?.label !== "string") return;
			if (vehicle.label.startsWith("LOT")) return;
			return vehicle.label;
		},
	},
	{
		id: "lio-lot",
		staticResourceHref: "https://pysae.com/api/v2/groups/lio-lot/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/lio-lot/gtfs-rt"],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		excludeScheduled: true,
		mode: "NO-TU",
		mapLineRef: (lineRef) => lineRef.split("|")[0],
		getNetworkRef: () => "LIO",
		getVehicleRef: (vehicle) => {
			if (typeof vehicle?.label !== "string") return;
			if (vehicle.label.startsWith("LOT")) return;
			return vehicle.label;
		},
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
		gtfsOptions: { shapesStrategy: "IGNORE" },
		excludeScheduled: true,
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
		gtfsOptions: { shapesStrategy: "IGNORE" },
		excludeScheduled: true,
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
		gtfsOptions: { shapesStrategy: "IGNORE" },
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
		gtfsOptions: {
			filterTrips: (trip) => {
				trip.route.id = trip.route.name;
				return true;
			},
		},
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
