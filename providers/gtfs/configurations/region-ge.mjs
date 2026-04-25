/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "fluo68",
		staticResourceHref: "https://pysae.com/api/v2/groups/fluo68-transdev/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/fluo68-transdev/gtfs-rt"],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		mode: "NO-TU",
		excludeScheduled: true,
		getNetworkRef: () => "FLUO-68",
		getVehicleRef: (vehicle) => vehicle?.label,
	},
	{
		id: "luneville",
		staticResourceHref: "https://pysae.com/api/v2/groups/luneo/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/luneo/gtfs-rt"],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		mode: "NO-TU",
		excludeScheduled: true,
		getNetworkRef: () => "LUNEO",
		getVehicleRef: (vehicle) => vehicle?.label,
	},
	{
		id: "thionville",
		staticResourceHref: "https://pysae.com/api/v2/groups/smitu/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/smitu/gtfs-rt"],
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: () => "CITELINE",
		getVehicleRef: (vehicle) => vehicle?.label ?? undefined,
		mapLineRef: (lineRef) => lineRef.slice(0, -3),
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
		id: "nancy",
		staticResourceHref: "https://gtfs.bus-tracker.fr/stan.zip",
		realtimeResourceHrefs: [
			"https://proxy.transport.data.gouv.fr/resource/fluo-stan-nancy-gtfs-rt-trip-update?token=KZL1tb49w8EZODCIq8b3RpI8DKoUB6iV27Cfw_KBoWY",
		],
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
		staticResourceHref: "https://gtfs.bus-tracker.fr/mulhouse.zip",
		realtimeResourceHrefs: [
			"https://proxy.transport.data.gouv.fr/resource/solea-mulhouse-gtfs-rt?token=KZL1tb49w8EZODCIq8b3RpI8DKoUB6iV27Cfw_KBoWY",
		],
		excludeScheduled: (journey) => journey.route.id === "93",
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
];

/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
	id: "ge",
	computeDelayMs: 30_000,
	sources,
};

export default configuration;
