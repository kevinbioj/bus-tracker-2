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
	//- NOMAD
	{
		id: "nomad-car",
		staticResourceHref: "https://gtfs.bus-tracker.fr/nomad.zip",
		realtimeResourceHrefs: [
			"https://api.atm.cityway.fr/dataflow/horaire-tc-tr/download?provider=NOMAD&dataFormat=GTFS-RT",
			"https://api.atm.cityway.fr/dataflow/vehicule-tc-tr/download?provider=NOMAD&dataFormat=GTFS-RT",
		],
		getAheadTime: () => 5 * 60,
		excludeScheduled: (trip) => ["216", "228", "423", "424", "527", "530"].includes(trip.route.name),
		getNetworkRef: () => "NOMAD-CAR",
		mapLineRef: (lineRef) => lineRef.slice(nthIndexOf(lineRef, ":", 2) + 1, nthIndexOf(lineRef, ":", 3)),
		mapStopRef: (stopRef) => stopRef.slice(nthIndexOf(stopRef, ":", 3) + 1, nthIndexOf(stopRef, ":", 4)),
		mapTripRef: (tripRef) => tripRef.slice(nthIndexOf(tripRef, ":", 2) + 1, nthIndexOf(tripRef, ":", 3)),
	},
	{
		id: "nomad-car-geo3d",
		staticResourceHref: "https://gtfs.bus-tracker.fr/nomad-geo3d.zip",
		realtimeResourceHrefs: [
			"https://lrn.geo3d.hanoverdisplays.com/api-1.0/gtfs-rt/trip-updates",
			"https://lrn.geo3d.hanoverdisplays.com/api-1.0/gtfs-rt/vehicle-positions",
		],
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: () => "NOMAD-CAR",
	},
	//- LiA
	{
		id: "lia",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/1e666e24-58ee-46b9-8952-ea2755ba88f2",
		realtimeResourceHrefs: [
			"https://gtfs.bus-tracker.fr/gtfs-rt/lia/trip-updates",
			"https://gtfs.bus-tracker.fr/gtfs-rt/lia/vehicle-positions",
		],
		mode: "NO-TU",
		getAheadTime: () => 60,
		excludeScheduled: (trip) => !["12", "13", "21", "Funi"].includes(trip.route.id),
		getNetworkRef: () => "LIA",
	},
	//- Cap Cotentin
	{
		id: "cap-cotentin",
		staticResourceHref: "https://pysae.com/api/v2/groups/transdev-cotentin/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/transdev-cotentin/gtfs-rt"],
		mode: "NO-TU",
		excludeScheduled: true,
		getNetworkRef: () => "CAP-COTENTIN",
		getVehicleRef: (vehicle) => vehicle?.label ?? undefined,
	},
	//- SEMO
	{
		id: "semo",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/98bbbf7c-10ff-48a0-afc2-c5f7b3dda5af",
		getNetworkRef: () => "SEMO",
		mapLineRef: (lineRef) => lineRef.slice(nthIndexOf(lineRef, ":", 2) + 1, nthIndexOf(lineRef, ":", 3)),
		mapStopRef: (stopRef) => stopRef.slice(nthIndexOf(stopRef, ":", 3) + 1, nthIndexOf(stopRef, ":", 4)),
		mapTripRef: (tripRef) => tripRef.slice(nthIndexOf(tripRef, ":", 2) + 1, nthIndexOf(tripRef, ":", 3)),
		getDestination: (journey) => journey?.calls.findLast((call) => call.status !== "SKIPPED")?.stop.name,
	},
	//- Transurbain
	{
		id: "transurbain",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/ec78df83-2e60-4284-acc3-86a0baa76bf0",
		realtimeResourceHrefs: [
			"https://api.atm.cityway.fr/dataflow/vehicule-tc-tr/download?provider=TRANSURBAIN&dataFormat=GTFS-RT",
			"https://api.atm.cityway.fr/dataflow/horaire-tc-tr/download?provider=TRANSURBAIN&dataFormat=GTFS-RT",
		],
		mode: "NO-TU",
		// 2025/01/23 - stop_id values in the Vehicle Position feed match the stop_code GTFS field instead
		// of the stop_id field. For now, we rely on passing time to determine the current stop. This map
		// must be removed whenever this gets fixed upstream.
		mapVehiclePosition: (vehicle) => {
			vehicle.stopId = undefined;
			return vehicle;
		},
		getNetworkRef: () => "TRANSURBAIN",
		getVehicleRef: (vehicleDescriptor) => vehicleDescriptor?.id.padStart(2, "0"),
		mapLineRef: (lineRef) => lineRef.slice(nthIndexOf(lineRef, ":", 2) + 1, nthIndexOf(lineRef, ":", 3)),
		mapStopRef: (stopRef) => stopRef.slice(nthIndexOf(stopRef, ":", 3) + 1, nthIndexOf(stopRef, ":", 4)),
		mapTripRef: (tripRef) => tripRef.slice(nthIndexOf(tripRef, ":", 2) + 1, nthIndexOf(tripRef, ":", 3)),
	},
	//- DeepMob
	{
		id: "deepmob",
		staticResourceHref: "https://api.atm.cityway.fr/dataflow/offre-tc/download?provider=DEEPMOB&dataFormat=GTFS",
		realtimeResourceHrefs: [
			"https://tud.geo3d.hanoverdisplays.com/api-1.0/gtfs-rt/vehicle-positions",
			"https://tud.geo3d.hanoverdisplays.com/api-1.0/gtfs-rt/trip-updates",
		],
		gtfsOptions: {
			mapRouteId: (routeId) => routeId.slice(nthIndexOf(routeId, ":", 2) + 1, nthIndexOf(routeId, ":", 3)),
			mapTripId: (tripId) => tripId.slice(nthIndexOf(tripId, ":", 2) + 1, nthIndexOf(tripId, ":", 3)),
			mapStopId: (stopId) => stopId.slice(nthIndexOf(stopId, ":", 2) + 1, nthIndexOf(stopId, ":", 3)),
		},
		mapTripUpdate: (tripUpdate) => {
			if (tripUpdate.stopTimeUpdate) {
				for (const stopTimeUpdate of tripUpdate.stopTimeUpdate) {
					if (stopTimeUpdate.stopId === "18548") {
						stopTimeUpdate.stopId = "18088";
					}
				}
			}
			return tripUpdate;
		},
		mode: "NO-TU",
		getNetworkRef: () => "DEEPMOB",
	},
	//- SNgo!
	{
		id: "sngo",
		staticResourceHref: "https://pysae.com/api/v2/groups/transdev-normandie-interurbain/gtfs/67e18513428ede837748ddd3",
		// "https://www.data.gouv.fr/fr/datasets/r/71bf48f1-178e-4ce3-ba9d-361cc5be76a7",
		realtimeResourceHrefs: [
			"https://tnvs.geo3d.hanoverdisplays.com/api-1.0/gtfs-rt/trip-updates",
			"https://tnvs.geo3d.hanoverdisplays.com/api-1.0/gtfs-rt/vehicle-positions",
		],
		mode: "NO-TU",
		gtfsOptions: {
			filterTrips: (trip) => trip.route.id !== "241",
			shapesStrategy: "IGNORE",
		},
		getNetworkRef: () => "SNGO",
	},
	//- SNgo! (navette Giverny)
	{
		id: "sngo-giverny",
		staticResourceHref: "https://pysae.com/api/v2/groups/SNGO-Giverny/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/SNGO-Giverny/gtfs-rt"],
		excludeScheduled: true,
		getNetworkRef: () => "SNGO",
		getVehicleRef: (vehicle) => vehicle.label ?? undefined,
	},
	//- Astrobus
	{
		id: "astrobus",
		staticResourceHref: "https://zenbus.net/gtfs/static/download.zip?dataset=astrobus",
		realtimeResourceHrefs: ["https://zenbus.net/gtfs/rt/poll.proto?dataset=astrobus"],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		mode: "VP-ONLY",
		excludeScheduled: true,
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
		mode: "NO-TU",
		excludeScheduled: (trip) => ["14", "30"].includes(trip.route.id),
		getNetworkRef: () => "REZOBUS",
		getVehicleRef: () => undefined,
	},
	//- Neva
	{
		id: "neva",
		staticResourceHref: "https://zenbus.net/gtfs/static/download.zip?dataset=granville",
		realtimeResourceHrefs: ["https://zenbus.net/gtfs/rt/poll.proto?dataset=granville"],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		mode: "NO-TU",
		excludeScheduled: true,
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
		excludeScheduled: true,
		getNetworkRef: () => "FICIBUS",
		mapLineRef: (lineRef) => lineRef.slice(nthIndexOf(lineRef, ":", 2) + 1, nthIndexOf(lineRef, ":", 3)),
		mapStopRef: (stopRef) => stopRef.slice(nthIndexOf(stopRef, ":", 3) + 1, nthIndexOf(stopRef, ":", 4)),
		mapTripRef: (tripRef) => tripRef.slice(nthIndexOf(tripRef, ":", 2) + 1, nthIndexOf(tripRef, ":", 3)),
	},
	//- Némus
	{
		id: "flers",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/388da89c-d15b-4496-810a-be250be9a26a",
		realtimeResourceHrefs: [
			"https://proxy.transport.data.gouv.fr/resource/flers-nemus-gtfs-rt-trip-update",
			"https://proxy.transport.data.gouv.fr/resource/flers-nemus-gtfs-rt-vehicle-position",
		],
		mode: "NO-TU",
		getNetworkRef: () => "NEMUS",
	},
	//- MOCA
	{
		id: "moca",
		staticResourceHref: "https://pysae.com/api/v2/groups/moca/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/moca/gtfs-rt"],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		mode: "NO-TU",
		excludeScheduled: true,
		getNetworkRef: () => "MOCA",
		getVehicleRef: (vehicle) => vehicle?.label ?? undefined,
	},
	//- Hobus
	{
		id: "hobus",
		staticResourceHref: "https://pysae.com/api/v2/groups/hobus/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/hobus/gtfs-rt"],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		mode: "NO-TU",
		excludeScheduled: true,
		getNetworkRef: () => "HOBUS",
		getVehicleRef: (descriptor) => descriptor?.label ?? undefined,
	},
	//- Bybus
	{
		id: "bybus",
		staticResourceHref: "https://pysae.com/api/v2/groups/keolis-bayeux/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/keolis-bayeux/gtfs-rt"],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		mode: "NO-TU",
		excludeScheduled: true,
		getNetworkRef: () => "BYBUS",
		getVehicleRef: (vehicle) => vehicle.label ?? undefined,
	},
	//- i'Bus
	{
		id: "ibus",
		staticResourceHref: "https://zenbus.net/gtfs/static/download.zip?dataset=bernay",
		realtimeResourceHrefs: ["https://zenbus.net/gtfs/rt/poll.proto?dataset=bernay"],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		mode: "NO-TU",
		excludeScheduled: true,
		getNetworkRef: () => "IBUS",
		getVehicleRef: () => undefined,
		mapLineRef: (lineRef) => lineRef.slice(nthIndexOf(lineRef, ":", 2) + 1, nthIndexOf(lineRef, ":", 3)),
		mapStopRef: (stopRef) => stopRef.slice(nthIndexOf(stopRef, ":", 3) + 1, nthIndexOf(stopRef, ":", 4)),
	},
	//- Slambus
	{
		id: "slambus",
		staticResourceHref: "https://exs.atm.cityway.fr/gtfs.aspx?key=OPENDATA&operatorCode=SLAM",
		getNetworkRef: () => "SLAMBUS",
		mapLineRef: (lineRef) => lineRef.slice(nthIndexOf(lineRef, ":", 2) + 1, nthIndexOf(lineRef, ":", 3)),
		mapStopRef: (stopRef) => stopRef.slice(nthIndexOf(stopRef, ":", 3) + 1, nthIndexOf(stopRef, ":", 4)),
		mapTripRef: (tripRef) => tripRef.slice(nthIndexOf(tripRef, ":", 2) + 1, nthIndexOf(tripRef, ":", 3)),
	},
	//- Vikibus
	{
		id: "vikibus",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/b3e50a9c-bdca-42c5-b04b-aeba964b0df8",
		getNetworkRef: () => "VIKIBUS",
	},
	//- Argentan Bus
	{
		id: "argentan-bus",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/bccfa3f2-ef45-4b9e-9586-7e117286bc60",
		realtimeResourceHrefs: [],
		getNetworkRef: () => "ARGENTAN-BUS",
		mapLineRef: (lineRef) => lineRef.slice(nthIndexOf(lineRef, ":", 2) + 1, nthIndexOf(lineRef, ":", 3)),
		mapStopRef: (stopRef) => stopRef.slice(nthIndexOf(stopRef, ":", 3) + 1, nthIndexOf(stopRef, ":", 4)),
		mapTripRef: (tripRef) => tripRef.slice(nthIndexOf(tripRef, ":", 2) + 1, nthIndexOf(tripRef, ":", 3)),
	},
	//- Cosibus
	{
		id: "cosibus",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/ff3d0940-f19a-4981-b4b1-6ddbc9c6018f",
		realtimeResourceHrefs: [],
		getNetworkRef: () => "COSIBUS",
		mapLineRef: (lineRef) => lineRef.slice(nthIndexOf(lineRef, ":", 2) + 1, nthIndexOf(lineRef, ":", 3)),
		mapStopRef: (stopRef) => stopRef.slice(nthIndexOf(stopRef, ":", 3) + 1, nthIndexOf(stopRef, ":", 4)),
		mapTripRef: (tripRef) => tripRef.slice(nthIndexOf(tripRef, ":", 2) + 1, nthIndexOf(tripRef, ":", 3)),
	},
	//- Amibus
	{
		id: "amibus",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/cdd4681c-dfcb-46c1-8802-2aae4f296618",
		realtimeResourceHrefs: [],
		getNetworkRef: () => "AMIBUS-VIRE",
		mapLineRef: (lineRef) => lineRef.slice(nthIndexOf(lineRef, ":", 2) + 1, nthIndexOf(lineRef, ":", 3)),
		mapStopRef: (stopRef) => stopRef.slice(nthIndexOf(stopRef, ":", 3) + 1, nthIndexOf(stopRef, ":", 4)),
		mapTripRef: (tripRef) => tripRef.slice(nthIndexOf(tripRef, ":", 2) + 1, nthIndexOf(tripRef, ":", 3)),
	},
	//- LeBus (Pont-Audemer)
	{
		id: "lebus",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/e8fe8980-c502-466c-9054-ddb28d367e4f",
		getNetworkRef: () => "LEBUS",
		mapLineRef: (lineRef) => lineRef.slice(nthIndexOf(lineRef, ":", 2) + 1, nthIndexOf(lineRef, ":", 3)),
		mapStopRef: (stopRef) => stopRef.slice(nthIndexOf(stopRef, ":", 3) + 1, nthIndexOf(stopRef, ":", 4)),
		mapTripRef: (tripRef) => tripRef.slice(nthIndexOf(tripRef, ":", 2) + 1, nthIndexOf(tripRef, ":", 3)),
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
