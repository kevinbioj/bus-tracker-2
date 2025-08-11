/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "beaune",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/c00d487c-4766-4ca1-b736-e7de110331d9",
		realtimeResourceHrefs: [
			"https://proxy.transport.data.gouv.fr/resource/beaune-cote-et-bus-gtfs-rt-trip-update?token=KZL1tb49w8EZODCIq8b3RpI8DKoUB6iV27Cfw_KBoWY",
			"https://proxy.transport.data.gouv.fr/resource/beaune-cote-et-bus-gtfs-rt-vehicle-position?token=KZL1tb49w8EZODCIq8b3RpI8DKoUB6iV27Cfw_KBoWY",
		],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		mode: "NO-TU",
		excludeScheduled: true,
		mapVehiclePosition: (vehicle) => {
			vehicle.vehicle.id = vehicle.vehicle.label;
			return vehicle;
		},
		getNetworkRef: () => "BEAUNE",
	},
	{
		id: "dijon",
		// 2025-08-11: using n-1 gtfs as n has missing services
		staticResourceHref:
			"https://transport-data-gouv-fr-resource-history-prod.cellar-c2.services.clever-cloud.com/80742/80742.20250627.140907.083882.zip",
		// staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/e0dbd217-15cd-4e28-9459-211a27511a34",
		realtimeResourceHrefs: [
			"https://proxy.transport.data.gouv.fr/resource/divia-dijon-gtfs-rt-trip-update",
			"https://proxy.transport.data.gouv.fr/resource/divia-dijon-gtfs-rt-vehicle-position",
		],
		mode: "NO-TU",
		gtfsOptions: { shapesStrategy: "IGNORE" },
		excludeScheduled: (trip) =>
			![
				"4-PL",
				"4-39",
				"4-61",
				"4-62",
				"4-63",
				"4-64",
				"4-65",
				"4-66",
				"4-67",
				"4-68",
				"4-69",
				"4-70",
				"4-71",
				"4-72",
				"4-73",
				"4-74",
				"4-75",
			].includes(trip.route),
		getNetworkRef: () => "DIVIA",
		getDestination: (journey) =>
			journey?.calls.findLast((call) => call.status !== "SKIPPED")?.stop.name ?? journey?.trip.headsign,
	},
	{
		id: "dole",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/a8c743ee-e2d4-408c-ac4b-6434b6eaadf9",
		realtimeResourceHrefs: [
			"https://proxy.transport.data.gouv.fr/resource/tgd-dole-gtfs-rt-vehicle-position",
			"https://proxy.transport.data.gouv.fr/resource/tgd-dole-gtfs-rt-trip-update",
		],
		mode: "NO-TU",
		getNetworkRef: () => "GRANDOLE",
	},
	{
		id: "thionville",
		staticResourceHref: "https://pysae.com/api/v2/groups/smitu/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/smitu/gtfs-rt"],
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: () => "CITELINE",
		getVehicleRef: (vehicle) => vehicle?.label ?? undefined,
	},
	{
		id: "metz",
		staticResourceHref: "https://data.lemet.fr/documents/LEMET-gtfs.zip",
		realtimeResourceHrefs: [
			"https://proxy.transport.data.gouv.fr/resource/lemet-metz-gtfs-rt-trip-update",
			"https://proxy.transport.data.gouv.fr/resource/lemet-metz-gtfs-rt-vehicle-position",
		],
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: () => "LEMET",
	},
	{
		id: "montbeliard",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/b45aa8d8-4bd4-4528-99c7-acfc980fdb09",
		realtimeResourceHrefs: [],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		getNetworkRef: () => "EVOLITY",
	},
	{
		id: "nancy",
		staticResourceHref: "https://hstan.g-ny.eu/gtfs/gtfs_stan.zip",
		realtimeResourceHrefs: [],
		getNetworkRef: () => "STAN",
	},
	{
		id: "reims",
		staticResourceHref:
			"https://www.datagrandest.fr/metadata/fluo-grand-est/FR-200052264-T0031-0000/fluo-grand-est-rei-gtfs.zip",
		realtimeResourceHrefs: ["https://proxy.transport.data.gouv.fr/resource/fluo-citura-reims-gtfs-rt"],
		gtfsOptions: {
			filterTrips: (trip) => !["23", "C", "E1", "E2", "E3", "E4", "E5", "E6", "E7"].includes(trip.route.id),
		},
		excludeScheduled: true,
		getNetworkRef: () => "GRM",
	},
	{
		id: "reims-express",
		staticResourceHref: "https://pysae.com/api/v2/groups/transdev-4k4N/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/transdev-4k4N/gtfs-rt"],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: () => "GRM",
		getVehicleRef: (vehicle) => {
			if (vehicle?.label === "newVehicle") return;
			return vehicle?.label ?? undefined;
		},
	},
	{
		id: "solea",
		staticResourceHref:
			"https://www.datagrandest.fr/metadata/fluo-grand-est/FR-200052264-T0014-0000/fluo-grand-est-sitram-gtfs.zip",
		realtimeResourceHrefs: ["https://proxy.transport.data.gouv.fr/resource/fluo-solea-mulhouse-gtfs-rt-service-alert"],
		getNetworkRef: () => "SOLEA",
	},
	{
		id: "strasbourg",
		staticResourceHref: "https://gtfs.bus-tracker.fr/cts.zip",
		realtimeResourceHrefs: ["https://gtfs.bus-tracker.fr/gtfs-rt/cts/trip-updates"],
		excludeScheduled: true,
		getNetworkRef: () => "CTS",
	},
	{
		id: "troyes",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/764e07f3-4297-44ac-810e-f3db295dbef6",
		realtimeResourceHrefs: [
			"https://transport.data.gouv.fr/resources/81544/download",
			"https://transport.data.gouv.fr/resources/81543/download",
		],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		mode: "NO-TU",
		excludeScheduled: true,
		getNetworkRef: () => "TCAT",
	},
	{
		id: "vesoul",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/0d6e6c56-8926-49b3-87e2-13c6f57c136b",
		realtimeResourceHrefs: [
			"https://proxy.transport.data.gouv.fr/resource/moova-vesoul-gtfs-rt-trip-update",
			"https://proxy.transport.data.gouv.fr/resource/moova-vesoul-gtfs-rt-vehicle-position",
		],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: () => "MOOVA",
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
