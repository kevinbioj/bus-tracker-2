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

/** @type {import('../src/model/source.ts').Source[]} */
const sources = [
	//- NOMAD
	{
		id: "nomad-car",
		staticResourceHref: "https://gtfs.bus-tracker.fr/nomad.zip",
		realtimeResourceHrefs: [
			"https://api.atm.cityway.fr/dataflow/horaire-tc-tr/download?provider=NOMAD&dataFormat=GTFS-RT",
			"https://api.atm.cityway.fr/dataflow/vehicule-tc-tr/download?provider=NOMAD&dataFormat=GTFS-RT",
		],
		getNetworkRef: () => "NOMAD-CAR",
		mapLineRef: (lineRef) => lineRef.slice(nthIndexOf(lineRef, ":", 2) + 1, nthIndexOf(lineRef, ":", 3)),
		mapStopRef: (stopRef) => stopRef.slice(nthIndexOf(stopRef, ":", 3) + 1, nthIndexOf(stopRef, ":", 4)),
		mapTripRef: (tripRef) => tripRef.slice(nthIndexOf(tripRef, ":", 2) + 1, nthIndexOf(tripRef, ":", 3)),
	},
	{
		id: "nomad-train",
		staticResourceHref: "https://gtfs.bus-tracker.fr/nomad-train.zip",
		realtimeResourceHrefs: ["https://proxy.transport.data.gouv.fr/resource/sncf-ter-gtfs-rt-trip-updates"],
		getNetworkRef: () => "NOMAD-TRAIN",
		mapLineRef: (lineRef) => lineRef.slice(nthIndexOf(lineRef, ":", 3) + 1, lineRef.lastIndexOf(":")),
		mapStopRef: (stopRef) => stopRef.slice(stopRef.indexOf(":") + 1),
		mapTripRef: (tripRef) => tripRef.slice(0, tripRef.indexOf(":")),
	},
	//- Astuce
	{
		id: "tcar",
		staticResourceHref: "https://api.mrn.cityway.fr/dataflow/offre-tc/download?provider=TCAR&dataFormat=GTFS",
		realtimeResourceHrefs: [
			"https://gtfs.bus-tracker.fr/gtfs-rt/tcar/trip-updates",
			"https://gtfs.bus-tracker.fr/gtfs-rt/tcar/vehicle-positions",
		],
		allowScheduled: (trip) =>
			["06", "89", "99"].includes(trip.route.id) ||
			["IST_", "INT_"].some((pattern) => trip.service.id.includes(pattern)),
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
		allowScheduled: (trip) => trip.route.name !== "06",
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
	//- LiA
	{
		id: "lia",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/1e666e24-58ee-46b9-8952-ea2755ba88f2",
		realtimeResourceHrefs: [
			"https://gtfs.bus-tracker.fr/gtfs-rt/lia/trip-updates",
			"https://gtfs.bus-tracker.fr/gtfs-rt/lia/vehicle-positions",
		],
		allowScheduled: (trip) => ["12", "13", "21"].includes(trip.route.id),
		getNetworkRef: () => "LIA",
	},
	//- Twisto
	//- Cap Cotentin
	{
		id: "cap-cotentin",
		staticResourceHref: "https://pysae.com/api/v2/groups/transdev-cotentin/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/transdev-cotentin/gtfs-rt"],
		allowScheduled: () => false,
		getNetworkRef: () => "CAP-COTENTIN",
	},
	//- SEMO
	{
		id: "semo",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/98bbbf7c-10ff-48a0-afc2-c5f7b3dda5af",
		gtfsOptions: { filterTrips: (trip) => trip.route.id.startsWith("S") },
		getNetworkRef: () => "SEMO",
		mapLineRef: (lineRef) => lineRef.slice(nthIndexOf(lineRef, ":", 2) + 1, nthIndexOf(lineRef, ":", 3)),
		mapStopRef: (stopRef) => stopRef.slice(nthIndexOf(stopRef, ":", 3) + 1, nthIndexOf(stopRef, ":", 4)),
		mapTripRef: (tripRef) => tripRef.slice(nthIndexOf(tripRef, ":", 2) + 1, nthIndexOf(tripRef, ":", 3)),
	},
	//- Transurbain
	{
		id: "transurbain",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/ec78df83-2e60-4284-acc3-86a0baa76bf0",
		getNetworkRef: () => "TRANSURBAIN",
		mapLineRef: (lineRef) => lineRef.slice(nthIndexOf(lineRef, ":", 2) + 1, nthIndexOf(lineRef, ":", 3)),
		mapStopRef: (stopRef) => stopRef.slice(nthIndexOf(stopRef, ":", 3) + 1, nthIndexOf(stopRef, ":", 4)),
		mapTripRef: (tripRef) => tripRef.slice(nthIndexOf(tripRef, ":", 2) + 1, nthIndexOf(tripRef, ":", 3)),
	},
	//- DeepMob
	{
		id: "deepmob",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/62248658-0eba-4f4e-b367-aaea635ecd38",
		realtimeResourceHrefs: [
			"https://tud.geo3d.hanoverdisplays.com/api-1.0/gtfs-rt/vehicle-positions",
			"https://tud.geo3d.hanoverdisplays.com/api-1.0/gtfs-rt/trip-updates",
		],
		mapLineRef: (lineRef) => lineRef.slice(nthIndexOf(lineRef, ":", 2) + 1, nthIndexOf(lineRef, ":", 3)),
		mapStopRef: (stopRef) => stopRef.slice(nthIndexOf(stopRef, ":", 3) + 1, nthIndexOf(stopRef, ":", 4)),
		mapTripRef: (tripRef) => tripRef.slice(nthIndexOf(tripRef, ":", 2) + 1, nthIndexOf(tripRef, ":", 3)),
		getNetworkRef: () => "DEEPMOB",
	},
	//- SNgo!
	{
		id: "sngo",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/71bf48f1-178e-4ce3-ba9d-361cc5be76a7",
		// realtimeResourceHrefs: [
		//   "https://tnvs.geo3d.hanoverdisplays.com/api-1.0/gtfs-rt/trip-updates",
		//   "https://tnvs.geo3d.hanoverdisplays.com/api-1.0/gtfs-rt/vehicle-positions",
		// ],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		getNetworkRef: () => "SNGO",
	},
	//- SNgo! (navette Giverny)
	{
		id: "sngo-giverny",
		staticResourceHref: "https://pysae.com/api/v2/groups/SNGO-Giverny/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/SNGO-Giverny/gtfs-rt"],
		allowScheduled: () => false,
		getNetworkRef: () => "SNGO",
		getVehicleRef: (vehicle) => vehicle.label ?? undefined,
	},
	//- Astrobus
	{
		id: "astrobus",
		staticResourceHref: "https://zenbus.net/gtfs/static/download.zip?dataset=astrobus",
		realtimeResourceHrefs: ["https://zenbus.net/gtfs/rt/poll.proto?dataset=astrobus"],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		allowScheduled: () => false,
		getNetworkRef: () => "ASTROBUS",
		getVehicleRef: () => undefined,
		mapLineRef: (lineRef) => lineRef.slice(nthIndexOf(lineRef, ":", 2) + 1, nthIndexOf(lineRef, ":", 3)),
		mapStopRef: (stopRef) => stopRef.slice(nthIndexOf(stopRef, ":", 3) + 1, nthIndexOf(stopRef, ":", 4)),
	},
	//- RezoBus
	{
		id: "rezobus",
		staticResourceHref: "https://pysae.com/api/v2/groups/caux-seine-agglo/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/caux-seine-agglo/gtfs-rt"],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		allowScheduled: (trip) => !["14", "30"].includes(trip.route.id),
		getNetworkRef: () => "REZOBUS",
		getVehicleRef: () => undefined,
	},
	//- Neva
	{
		id: "neva",
		staticResourceHref: "https://zenbus.net/gtfs/static/download.zip?dataset=granville",
		realtimeResourceHrefs: ["https://zenbus.net/gtfs/rt/poll.proto?dataset=granville"],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		allowScheduled: () => false,
		getNetworkRef: () => "NEVA",
		getVehicleRef: () => undefined,
		mapLineRef: (lineRef) => lineRef.slice(nthIndexOf(lineRef, ":", 2) + 1, nthIndexOf(lineRef, ":", 3)),
		mapStopRef: (stopRef) => stopRef.slice(nthIndexOf(stopRef, ":", 3) + 1, nthIndexOf(stopRef, ":", 4)),
	},
	//- Ficibus
	{
		id: "ficibus",
		staticResourceHref: "https://exs.atm.cityway.fr/gtfs.aspx?key=OPENDATA&operatorCode=FICIBUS",
		realtimeResourceHrefs: [
			"https://gtfs.bus-tracker.fr/gtfs-rt/ficibus/trip-updates",
			"https://gtfs.bus-tracker.fr/gtfs-rt/ficibus/vehicle-positions",
		],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		allowScheduled: () => false,
		getNetworkRef: () => "FICIBUS",
		mapLineRef: (lineRef) => lineRef.slice(nthIndexOf(lineRef, ":", 2) + 1, nthIndexOf(lineRef, ":", 3)),
		mapStopRef: (stopRef) => stopRef.slice(nthIndexOf(stopRef, ":", 3) + 1, nthIndexOf(stopRef, ":", 4)),
		mapTripRef: (tripRef) => tripRef.slice(nthIndexOf(tripRef, ":", 2) + 1, nthIndexOf(tripRef, ":", 3)),
	},
	//- MOCA
	{
		id: "moca",
		staticResourceHref: "https://pysae.com/api/v2/groups/moca/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/moca/gtfs-rt"],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		allowScheduled: () => false,
		getNetworkRef: () => "MOCA",
		getVehicleRef: (vehicle) => vehicle.label ?? undefined,
	},
	//- Hobus
	{
		id: "hobus",
		staticResourceHref: "https://zenbus.net/gtfs/static/download.zip?dataset=hobus",
		realtimeResourceHrefs: ["https://zenbus.net/gtfs/rt/poll.proto?dataset=hobus"],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		allowScheduled: () => false,
		getNetworkRef: () => "HOBUS",
		getVehicleRef: () => undefined,
		mapLineRef: (lineRef) => lineRef.slice(nthIndexOf(lineRef, ":", 2) + 1, nthIndexOf(lineRef, ":", 3)),
		mapStopRef: (stopRef) => stopRef.slice(nthIndexOf(stopRef, ":", 3) + 1, nthIndexOf(stopRef, ":", 4)),
	},
	//- Bybus
	{
		id: "bybus",
		staticResourceHref: "https://pysae.com/api/v2/groups/keolis-bayeux/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/keolis-bayeux/gtfs-rt"],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		allowScheduled: () => false,
		getNetworkRef: () => "BYBUS",
		getVehicleRef: (vehicle) => vehicle.label ?? undefined,
	},
	//- i'Bus
	{
		id: "ibus",
		staticResourceHref: "https://zenbus.net/gtfs/static/download.zip?dataset=bernay",
		realtimeResourceHrefs: ["https://zenbus.net/gtfs/rt/poll.proto?dataset=bernay"],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		allowScheduled: () => false,
		getNetworkRef: () => "IBUS",
		getVehicleRef: () => undefined,
		mapLineRef: (lineRef) => lineRef.slice(nthIndexOf(lineRef, ":", 2) + 1, nthIndexOf(lineRef, ":", 3)),
		mapStopRef: (stopRef) => stopRef.slice(nthIndexOf(stopRef, ":", 3) + 1, nthIndexOf(stopRef, ":", 4)),
	},
	//- LeBus (Pont-Audemer)
	{
		id: "lebus",
		staticResourceHref: "https://gtfs.bus-tracker.fr/lebus.zip",
		getNetworkRef: () => "LEBUS",
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
