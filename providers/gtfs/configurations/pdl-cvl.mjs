/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "aleop",
		// 2024-01-24 : TLS KO - Upload chez nous le temps de la résolution
		// staticResourceHref: "https://donnees.paysdelaloire.fr/data/pdl.zip",
		staticResourceHref: "https://gtfs.bus-tracker.fr/aleop.zip",
		realtimeResourceHrefs: [
			"https://proxy.transport.data.gouv.fr/resource/aleop-pdl-gtfs-rt-trip-update",
			"https://proxy.transport.data.gouv.fr/resource/aleop-pdl-gtfs-rt-vehicle-position",
			"https://gtfs.bus-tracker.fr/gtfs-rt/aleop-300/vehicle-positions",
		],
		mode: "NO-TU",
		getNetworkRef: () => "ALEOP",
		getVehicleRef: (descriptor) => +descriptor?.label || undefined,
		getDestination: (journey) => journey?.trip.headsign?.replace("→", ">"),
	},
	{
		id: "angers",
		staticResourceHref: "https://chouette.enroute.mobi/api/v1/datas/Irigo/gtfs.zip",
		realtimeResourceHrefs: [
		  "https://ara-api.enroute.mobi/irigo/gtfs/trip-updates",
				"https://ara-api.enroute.mobi/irigo/gtfs/vehicle-positions",
		],
		mode: "NO-TU",
		gtfsOptions: {
			filterTrips: (trip) =>
				[
					"01",
					"02",
					"03",
					"04",
					"05",
					"06",
					"07",
					"08",
					"09",
					"10",
					"11",
					"12",
					"20",
					"21",
					"22",
					"23",
					"24",
					"25",
					"A",
					"B",
					"C",
					"NavM",
					"Tbus",
				].includes(trip.route.id),
		},
		mapVehiclePosition: (vehicle) => {
			 if (vehicle.vehicle.id.startsWith("vehicle")) {
					 return [];
				}
			 return vehicle;
		},
		getNetworkRef: () => "IRIGO",
	},
	{
		id: "angers-sub",
		staticResourceHref: "https://pysae.com/api/v2/groups/irigo/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/irigo/gtfs-rt"],
		mode: "NO-TU",
		getNetworkRef: () => "IRIGO",
		getVehicleRef: (descriptor) => descriptor?.label?.trim() || undefined,
	},
	{
		id: "lemans",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/5339d96c-6d20-4a01-939a-40f7b56d6cc1",
		realtimeResourceHrefs: ["https://proxy.transport.data.gouv.fr/resource/setram-lemans-gtfs-rt-trip-update"],
		getNetworkRef: () => "SETRAM",
	},
	{
		id: "nantes",
		staticResourceHref:
			"https://data.nantesmetropole.fr/explore/dataset/244400404_transports_commun_naolib_nantes_metropole_gtfs/files/0cc0469a72de54ee045cb66d1a21de9e/download/",
		realtimeResourceHrefs: [
			"https://api.staging.okina.fr/gateway/semgtfsrt/realtime/trip-updates/NAOLIBORG",
			"https://api.staging.okina.fr/gateway/semgtfsrt/realtime/vehicle-positions/NAOLIBORG",
		],
		getNetworkRef: () => "NAOLIB",
		getVehicleRef: () => undefined,
		mapLineRef: (lineRef) => lineRef.slice(lineRef.lastIndexOf(":") + 1),
		mapStopRef: (stopRef) => stopRef.slice(stopRef.lastIndexOf(":") + 1),
		mapTripRef: (tripRef) => tripRef.slice(tripRef.lastIndexOf(":") + 1),
	},
	{
		id: "remi-28",
		staticResourceHref: "https://www.transdev-centrevaldeloire.com/cvl/open-data/remi-28/gtfs",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/eure-et-loir-mobilite/gtfs-rt"],
		mode: "NO-TU",
		getNetworkRef: () => "REMI",
		getVehicleRef: (vehicle) => +vehicle?.label || undefined,
	},
	{
		id: "remi-37",
		staticResourceHref: "https://www.transdev-centrevaldeloire.com/cvl/open-data/remi-37/gtfs",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/remi-37/gtfs-rt"],
		mode: "NO-TU",
		getNetworkRef: () => "REMI",
		getVehicleRef: (vehicle) => +vehicle?.label || undefined,
	},
	{
		id: "remi-41",
		staticResourceHref: "https://www.transdev-centrevaldeloire.com/cvl/open-data/remi-41/gtfs",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/remi-41/gtfs-rt"],
		mode: "NO-TU",
		getNetworkRef: () => "REMI",
		getVehicleRef: (vehicle) => +vehicle?.label || undefined,
	},
	{
		id: "remi-45",
		staticResourceHref: "https://www.transdev-centrevaldeloire.com/cvl/open-data/remi-45/gtfs",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/remi-45/gtfs-rt"],
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
		mode: "NO-TU",
		excludeScheduled: true,
		getNetworkRef: () => "FILBLEU",
		mapLineRef: (lineRef) => lineRef.slice(lineRef.lastIndexOf(":") + 1),
		mapStopRef: (stopRef) => stopRef.slice(stopRef.lastIndexOf(":") + 1),
		mapTripRef: (tripRef) => tripRef.slice(tripRef.indexOf(":") + 1),
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
