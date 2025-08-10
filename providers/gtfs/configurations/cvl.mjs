/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "orleans",
		staticResourceHref: "https://chouette.enroute.mobi/api/v1/datas/keolis_orleans.gtfs.zip",
		realtimeResourceHrefs: [
			"https://ara-api.enroute.mobi/tao/gtfs/trip-updates",
			"https://ara-api.enroute.mobi/tao/gtfs/vehicle-positions",
		],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		mode: "NO-TU",
		excludeScheduled: true,
		getNetworkRef: () => "TAO",
		mapLineRef: (lineRef) => lineRef.slice("ORLEANS:Line:".length),
		mapStopRef: (stopRef) => stopRef.slice("ORLEANS:StopArea:".length),
		mapTripRef: (tripRef) => tripRef.replace(/(ORLEANS|chouette):VehicleJourney:/, ""),
	},
	{
		id: "remi-28",
		staticResourceHref: "https://www.transdev-centrevaldeloire.com/cvl/open-data/remi-28/gtfs",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/eure-et-loir-mobilite/gtfs-rt"],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: () => "REMI",
		getVehicleRef: (vehicle) => +vehicle?.label || undefined,
	},
	{
		id: "remi-37",
		staticResourceHref: "https://www.transdev-centrevaldeloire.com/cvl/open-data/remi-37/gtfs",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/remi-37/gtfs-rt"],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: () => "REMI",
		getVehicleRef: (vehicle) => +vehicle?.label || undefined,
	},
	{
		id: "remi-41",
		staticResourceHref: "https://www.transdev-centrevaldeloire.com/cvl/open-data/remi-41/gtfs",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/remi-41/gtfs-rt"],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: () => "REMI",
		getVehicleRef: (vehicle) => +vehicle?.label || undefined,
	},
	{
		id: "remi-45",
		staticResourceHref: "https://www.transdev-centrevaldeloire.com/cvl/open-data/remi-45/gtfs",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/remi-45/gtfs-rt"],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: () => "REMI",
		getVehicleRef: (vehicle) => +vehicle?.label || undefined,
	},
	{
		id: "tours",
		staticResourceHref:
			"https://data.tours-metropole.fr/api/v2/catalog/datasets/horaires-temps-reel-gtfsrt-reseau-filbleu-tmvl/alternative_exports/filbleu_gtfszip",
		realtimeResourceHrefs: [
			"https://data.filbleu.fr/ws-tr/gtfs-rt/opendata/trip-updates",
			"https://data.filbleu.fr/ws-tr/gtfs-rt/opendata/vehicle-positions",
		],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		mode: "NO-TU",
		excludeScheduled: true,
		getNetworkRef: () => "FILBLEU",
		mapLineRef: (lineRef) => lineRef.slice(lineRef.lastIndexOf(":") + 1),
		mapStopRef: (stopRef) => stopRef.slice(stopRef.lastIndexOf(":") + 1),
		mapTripRef: (tripRef) => tripRef.slice(tripRef.indexOf(":") + 1),
	},
	{
		id: "vendome",
		staticResourceHref: "https://pysae.com/api/v2/groups/vendome/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/vendome/gtfs-rt"],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: () => "MOVE",
		getVehicleRef: (vehicle) => vehicle?.label,
	},
	{
		id: "vierzon",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/87091347-c7fa-4e63-8fb5-005891ece43b",
		realtimeResourceHrefs: [
			"https://proxy.transport.data.gouv.fr/resource/le-vib-vierzon-gtfs-rt-trip-update",
			"https://proxy.transport.data.gouv.fr/resource/le-vib-vierzon-gtfs-rt-vehicle-position",
		],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: () => "LEVIB",
		getVehicleRef: (vehicle) => vehicle?.label ?? undefined,
	},
];

/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
	computeDelayMs: 15_000,
	redisOptions: {
		url: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
		username: process.env.REDIS_USERNAME,
		password: process.env.REDIS_PASSWORD,
	},
	sources,
};

export default configuration;
