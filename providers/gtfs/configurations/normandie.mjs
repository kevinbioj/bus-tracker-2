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
		excludeScheduled: (trip) => !["12", "13", "21"].includes(trip.route.id),
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
	},
	//- SEMO
	{
		id: "semo",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/98bbbf7c-10ff-48a0-afc2-c5f7b3dda5af",
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
		mode: "NO-TU",
		mapLineRef: (lineRef) =>
			lineRef.indexOf(":") >= 0 ? lineRef.slice(nthIndexOf(lineRef, ":", 2) + 1, nthIndexOf(lineRef, ":", 3)) : lineRef,
		mapStopRef: (stopRef) => stopRef.slice(nthIndexOf(stopRef, ":", 3) + 1, nthIndexOf(stopRef, ":", 4)),
		mapTripRef: (tripRef) => tripRef.slice(nthIndexOf(tripRef, ":", 2) + 1, nthIndexOf(tripRef, ":", 3)),
		getNetworkRef: () => "DEEPMOB",
	},
	//- SNgo!
	{
		id: "sngo",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/71bf48f1-178e-4ce3-ba9d-361cc5be76a7",
		realtimeResourceHrefs: [
			"https://tnvs.geo3d.hanoverdisplays.com/api-1.0/gtfs-rt/trip-updates",
			"https://tnvs.geo3d.hanoverdisplays.com/api-1.0/gtfs-rt/vehicle-positions",
		],
		mode: "NO-TU",
		gtfsOptions: { shapesStrategy: "IGNORE" },
		getNetworkRef: () => "SNGO",
	},
	//- SNgo! (navette Giverny) - OFF jusqu'au printemps
	// {
	// 	id: "sngo-giverny",
	// 	staticResourceHref: "https://pysae.com/api/v2/groups/SNGO-Giverny/gtfs/pub",
	// 	realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/SNGO-Giverny/gtfs-rt"],
	// 	excludeScheduled: true,
	// 	getNetworkRef: () => "SNGO",
	// 	getVehicleRef: (vehicle) => vehicle.label ?? undefined,
	// },
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
		getVehicleRef: (vehicle) => vehicle.label ?? undefined,
	},
	//- Hobus
	{
		id: "hobus",
		staticResourceHref: "https://zenbus.net/gtfs/static/download.zip?dataset=hobus",
		realtimeResourceHrefs: ["https://zenbus.net/gtfs/rt/poll.proto?dataset=hobus"],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		mode: "NO-TU",
		excludeScheduled: true,
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
		realtimeResourceHrefs: [
			"https://gtfs.bus-tracker.fr/gtfs-rt/slam/vehicle-positions",
			"https://gtfs.bus-tracker.fr/gtfs-rt/slam/trip-updates",
		],
		excludeScheduled: true,
		getNetworkRef: () => "SLAMBUS",
		getVehicleRef: () => undefined,
		mapLineRef: (lineRef) => lineRef.slice(nthIndexOf(lineRef, ":", 2) + 1, nthIndexOf(lineRef, ":", 3)),
		mapStopRef: (stopRef) => stopRef.slice(nthIndexOf(stopRef, ":", 3) + 1, nthIndexOf(stopRef, ":", 4)),
		mapTripRef: (tripRef) => tripRef.slice(nthIndexOf(tripRef, ":", 2) + 1, nthIndexOf(tripRef, ":", 3)),
	},
	//- Vikibus
	{
		id: "vikibus",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/b3e50a9c-bdca-42c5-b04b-aeba964b0df8",
		realtimeResourceHrefs: [
			"https://gtfs.bus-tracker.fr/gtfs-rt/vikibus/vehicle-positions",
			"https://gtfs.bus-tracker.fr/gtfs-rt/vikibus/trip-updates",
		],
		getNetworkRef: () => "VIKIBUS",
	},
	//- Argentan Bus
	{
		id: "argentan-bus",
		staticResourceHref: "https://transport.data.gouv.fr/datasets/argentanbus-argentan-intercom",
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
		staticResourceHref: "https://transport.data.gouv.fr/datasets/amibus-intercom-de-la-vire-au-noireau",
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
	//- Bacs de Seine-Maritime
	{
		id: "bacs-76",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/fbbbec28-bcdb-4158-a868-6f0b388f3208",
		realtimeResourceHrefs: [],
		getNetworkRef: () => "CG76",
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
