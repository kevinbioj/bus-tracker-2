/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "tcar",
		staticResourceHref: "https://exs.tcar.cityway.fr/gtfs.aspx?key=OPENDATA&operatorCode=ASTUCE",
		realtimeResourceHrefs: [
			"https://www.reseau-astuce.fr/ftp/gtfsrt/Astuce.TripUpdate.pb",
			"https://www.reseau-astuce.fr/ftp/gtfsrt/Astuce.VehiclePosition.pb",
		],
		excludeScheduled: (trip) =>
			!["06", "89", "99"].includes(trip.route.id) &&
			!["IST_", "INT_"].some((pattern) => trip.service.id.includes(pattern)),
		getNetworkRef: () => "ASTUCE",
		getOperatorRef: (journey, vehicle) => {
			if (
				journey?.trip.route.id === "06" ||
				journey?.trip.route.id === "89" ||
				journey?.trip.service.id.includes("IST_") ||
				journey?.trip.service.id.includes("INT_")
			)
				return "TNI";
			if (typeof vehicle !== "undefined" && +vehicle.id >= 670 && +vehicle.id <= 685) return "TNI";
			return "TCAR";
		},
	},
	{
		id: "tae",
		staticResourceHref: "https://gtfs.tae76.fr/gtfs/feed.zip",
		realtimeResourceHrefs: ["https://gtfs.tae76.fr/gtfs-rt.bin"],
		getAheadTime: (journey) =>
			journey?.calls.some((c) => !!(c.expectedArrivalTime ?? c.expectedDepartureTime)) ? 15 * 60 : 0,
		getNetworkRef: () => "ASTUCE",
		getOperatorRef: () => "TAE",
	},
	{
		id: "tgr",
		staticResourceHref: "https://pysae.com/api/v2/groups/tcar/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/tcar/gtfs-rt"],
		excludeScheduled: (trip) => trip.route.name === "06",
		getNetworkRef: () => "ASTUCE",
		getOperatorRef: () => "TNI",
	},
	{
		id: "tni",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/e39d7fe1-8c0c-4273-9236-d7c458add7a0",
		realtimeResourceHrefs: [
			"https://mrn.geo3d.hanoverdisplays.com/api-1.0/gtfs-rt/trip-updates",
			"https://mrn.geo3d.hanoverdisplays.com/api-1.0/gtfs-rt/vehicle-positions",
		],
		getNetworkRef: () => "ASTUCE",
		getOperatorRef: () => "TNI",
		mapVehiclePosition: (vehicle) => {
			vehicle.vehicle.id = vehicle.vehicle.label;
			return vehicle;
		},
	},
];

/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
	computeDelayMs: 10_000,
	redisOptions: {
		url: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
		username: process.env.REDIS_USERNAME,
		password: process.env.REDIS_PASSWORD,
	},
	sources,
};

export default configuration;
