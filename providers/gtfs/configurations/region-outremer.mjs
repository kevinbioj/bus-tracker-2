/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "971-karulis",
		staticResourceHref: "https://www.data.gouv.fr/api/1/datasets/r/ac89688b-252b-4b23-9e97-39226402cf2b",
		realtimeResourceHrefs: [],
		gtfsOptions: {
			computeShapeDistTraveled: "always",
			postLoad: (resource) => {
				resource.routes.forEach((route) => {
					route.agency.timeZone = "America/Guadeloupe";
				});
			},
		},
		getNetworkRef: () => "KARULIS",
	},
	{
		id: "971-tungt",
		staticResourceHref: "https://www.data.gouv.fr/api/1/datasets/r/dbfbff0f-46b6-44d5-a4d4-60d4ac645026",
		realtimeResourceHrefs: [],
		gtfsOptions: {
			computeShapeDistTraveled: "always",
			postLoad: (resource) => {
				resource.routes.forEach((route) => {
					route.agency.timeZone = "America/Guadeloupe";
				});
			},
		},
		getNetworkRef: () => "TUNGT",
	},
	{
		id: "972-sud-lib",
		staticResourceHref: "https://gtfs.bus-tracker.fr/sudlib.zip",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/sud_lib/gtfs-rt"],
		mode: "NO-TU",
		getNetworkRef: () => "SUD-LIB",
		getVehicleRef: (vehicle) => vehicle?.label,
	},
	{
		id: "974-alterneo",
		staticResourceHref: "https://transport.data.gouv.fr/resources/80676/download",
		realtimeResourceHrefs: [
			"https://proxy.transport.data.gouv.fr/resource/alterneo-civis-gtfs-rt-trip-update",
			"https://proxy.transport.data.gouv.fr/resource/alterneo-civis-gtfs-rt-vehicle-position",
		],
		mode: "NO-TU",
		excludeScheduled: true,
		getNetworkRef: () => "ALTERNEO",
		getDestination: (journey) =>
			journey?.calls.findLast((call) => call.status !== "SKIPPED")?.stop.name ?? journey?.trip.headsign,
	},
	{
		id: "974-car-jaune",
		staticResourceHref: "https://pysae.com/api/v2/groups/car-jaune/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/car-jaune/gtfs-rt"],
		mode: "NO-TU",
		excludeScheduled: true,
		getNetworkRef: () => "CAR-JAUNE",
		getVehicleRef: (vehicle) => vehicle?.label,
	},
	{
		id: "974-citalis",
		staticResourceHref: "https://gtfs.bus-tracker.fr/citalis.zip",
		realtimeResourceHrefs: [],
		getNetworkRef: () => "CITALIS",
	},
	{
		id: "974-karouest",
		staticResourceHref: "https://pysae.com/api/v2/groups/semto-2/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/semto-2/gtfs-rt"],
		mode: "NO-TU",
		getNetworkRef: () => "KAROUEST",
		getDestination: (journey) => journey?.calls?.findLast((call) => call.status !== "SKIPPED")?.stop.name,
		getVehicleRef: (vehicle) => vehicle?.label,
	},
];

/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
	id: "outremer",
	computeDelayMs: 30_000,
	sources,
};

export default configuration;
