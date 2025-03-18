/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "tcar",
		staticResourceHref: "https://api.mrn.cityway.fr/dataflow/offre-tc/download?provider=TCAR&dataFormat=GTFS",
		realtimeResourceHrefs: [
			"https://gtfs.bus-tracker.fr/gtfs-rt/tcar/trip-updates",
			"https://gtfs.bus-tracker.fr/gtfs-rt/tcar/vehicle-positions",
		],
		mode: "NO-TU",
		gtfsOptions: {
			shapesStrategy: "IGNORE",
		},
		// 2025-03-18: run trips in scheduled mode until real-time gets fixed
		excludeScheduled: (trip) => +trip.route.id < 100,
		// excludeScheduled: (trip) => !["06", "89", "98"].includes(trip.route.id),
		getNetworkRef: () => "ASTUCE",
		getOperatorRef: (journey, vehicle) => {
			if (journey?.trip.route.id === "06" || journey?.trip.route.id === "89") return "TNI";
			if (typeof vehicle !== "undefined" && +vehicle.id >= 670 && +vehicle.id <= 685) return "TNI";
			return "TCAR";
		},
		getVehicleRef: (vehicle) => vehicle?.id,
		getDestination: (journey, vehicle) => vehicle?.label ?? journey.calls.at(-1)?.stop.name ?? "Spécial",
	},
	{
		id: "tae",
		staticResourceHref: "https://gtfs.bus-tracker.fr/tae.zip",
		realtimeResourceHrefs: ["https://gtfs.tae76.fr/gtfs-rt.bin"],
		excludeScheduled: (trip) => trip.route.name !== "I",
		mapTripUpdate: (tripUpdate) => {
			if (typeof tripUpdate.vehicle?.id === "undefined") return;
			if (tripUpdate.stopTimeUpdate?.some(({ arrival }) => arrival?.delay > 5400)) return;
			return tripUpdate;
		},
		getDestination: (journey) =>
			journey?.trip.stopTimes
				.at(-1)
				.stop.name.toUpperCase()
				.normalize("NFD")
				.replace(/\p{Diacritic}/gu, ""),
		getAheadTime: (journey) =>
			journey?.calls.some((c) => !!(c.expectedArrivalTime ?? c.expectedDepartureTime)) ? 15 * 60 : 0,
		getNetworkRef: () => "ASTUCE",
		getOperatorRef: () => "TAE",
		isValidJourney: (vehicleJourney) => typeof vehicleJourney.vehicleRef !== "undefined",
	},
	{
		id: "tgr",
		staticResourceHref: "https://gtfs.bus-tracker.fr/tcar-tgr.zip",
		// staticResourceHref: "https://pysae.com/api/v2/groups/tcar/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/tcar/gtfs-rt"],
		mode: "NO-TU",
		excludeScheduled: (trip) => trip.route.name === "06",
		getNetworkRef: () => "ASTUCE",
		getOperatorRef: () => "TNI",
		getVehicleRef: (descriptor) => descriptor?.label ?? undefined,
	},
	{
		id: "tni",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/e39d7fe1-8c0c-4273-9236-d7c458add7a0",
		realtimeResourceHrefs: [
			"https://mrn.geo3d.hanoverdisplays.com/api-1.0/gtfs-rt/trip-updates",
			"https://mrn.geo3d.hanoverdisplays.com/api-1.0/gtfs-rt/vehicle-positions",
		],
		mode: "NO-TU",
		getNetworkRef: (journey) => {
			if (
				typeof journey !== "undefined" &&
				journey.trip.route.name === "530" &&
				[journey.calls.at(0), journey.calls.at(-1)].some((call) => call.stop.name === "Caudebec - Quai")
			) {
				return "NOMAD-CAR";
			}
			return "ASTUCE";
		},
		getDestination: (journey) => `${journey.calls.at(0)?.stop.name} > ${journey.calls.at(-1)?.stop.name}`,
		getOperatorRef: () => "TNI",
	},
	{
		id: "hanga",
		staticResourceHref: "https://exs.tcar.cityway.fr/gtfs.aspx?key=OPENDATA&operatorCode=ASTUCE&companyCode=ASTUCE:004",
		realtimeResourceHrefs: [],
		getNetworkRef: () => "ASTUCE",
		getOperatorRef: (journey) => (["204", "214"].includes(journey?.trip.route.id) ? "TNI" : "HANGA"),
		getDestination: (journey) => journey?.trip.stopTimes.at(-1).stop.name,
	},
];

/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
	computeDelayMs: 20_000,
	redisOptions: {
		url: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
		username: process.env.REDIS_USERNAME,
		password: process.env.REDIS_PASSWORD,
	},
	sources,
};

export default configuration;
