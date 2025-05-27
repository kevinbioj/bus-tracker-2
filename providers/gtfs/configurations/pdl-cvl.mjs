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

const nantesZenbusVehicleIdToLabel = new Map([
	["zenbus:Vehicle:4865174679846912:LOC", "1007"],
	["zenbus:Vehicle:5200553242001408:LOC", "1054"],
	["zenbus:Vehicle:4867052192923648:LOC", "1058"],
	["zenbus:Vehicle:895000002:LOC", "1061"],
	["zenbus:Vehicle:5122400943341568:LOC", "1062"],
	["zenbus:Vehicle:5182534931447808:LOC", "1086"],
	["zenbus:Vehicle:892890033:LOC", "1087"],
	["zenbus:Vehicle:901640003:LOC", "1088"],
	["zenbus:Vehicle:5095547666956288:LOC", "1089"],
	["zenbus:Vehicle:900880003:LOC", "1090"],
	["zenbus:Vehicle:886860002:LOC", "1100"],
	["zenbus:Vehicle:900890002:LOC", "1101"],
	["zenbus:Vehicle:900940030:LOC", "1102"],
	["zenbus:Vehicle:4895557152669696:LOC", "1104"],
	["zenbus:Vehicle:912870002:LOC", "1105"],
	["zenbus:Vehicle:5193131202969600:LOC", "1108"],
	["zenbus:Vehicle:892890034:LOC", "1109"],
	["zenbus:Vehicle:4902176938786816:LOC", "1110"],
	["zenbus:Vehicle:5201965212499968:LOC", "1111"],
	["zenbus:Vehicle:912900002:LOC", "1130"],
	["zenbus:Vehicle:5171109932564480:LOC", "1131"],
]);

/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "aleop",
		staticResourceHref: "https://donnees.paysdelaloire.fr/data/pdl.zip",
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
		excludeScheduled: true,
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
			if (Number.isNaN(+vehicle.vehicle.id)) {
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
		getVehicleRef: (descriptor) => {
			if (Number.isNaN(+descriptor?.label?.trim())) return undefined;
			return +descriptor?.label?.trim();
		},
	},
	{
		id: "orleans",
		staticResourceHref: "https://chouette.enroute.mobi/api/v1/datas/keolis_orleans.gtfs.zip",
		realtimeResourceHrefs: [
			"https://ara-api.enroute.mobi/tao/gtfs/trip-updates",
			"https://ara-api.enroute.mobi/tao/gtfs/vehicle-positions",
		],
		mode: "NO-TU",
		excludeScheduled: true,
		getNetworkRef: () => "TAO",
		mapLineRef: (lineRef) => lineRef.slice("ORLEANS:Line:".length),
		mapStopRef: (stopRef) => stopRef.slice("ORLEANS:StopArea:".length),
		mapTripRef: (tripRef) => tripRef.replace(/(ORLEANS|chouette):VehicleJourney:/, ""),
	},
	{
		id: "nantes",
		staticResourceHref:
			"https://data.nantesmetropole.fr/explore/dataset/244400404_transports_commun_naolib_nantes_metropole_gtfs/files/0cc0469a72de54ee045cb66d1a21de9e/download/",
		realtimeResourceHrefs: [
			"https://api.staging.okina.fr/gateway/semgtfsrt/realtime/trip-updates/NAOLIBORG",
			"https://api.staging.okina.fr/gateway/semgtfsrt/realtime/vehicle-positions/NAOLIBORG",
		],
		excludeScheduled: (trip) =>
			[
				"27",
				"28",
				"33",
				"40",
				"42",
				"47",
				"59",
				"60",
				"66",
				"67",
				"71",
				"75",
				"77",
				"78",
				"79",
				"80",
				"81",
				"87",
				"88",
				"89",
				"95",
				"96",
				"101",
				"102",
				"105",
				"107",
				"108",
				"109",
				"117",
				"118",
				"119",
				"128",
				"129",
				"131",
				"135",
				"138",
				"141",
				"149",
				"157",
				"158",
				"179",
				"E1",
				"E4",
				"E5",
				"E8",
				"N1",
				"N2",
				"LCE",
				"LCN",
				"LCO",
				"93",
				"91",
			].includes(trip.route.name),
		getNetworkRef: () => "NAOLIB",
		getVehicleRef: () => undefined,
		mapLineRef: (lineRef) => lineRef.slice(lineRef.lastIndexOf(":") + 1),
		mapStopRef: (stopRef) => stopRef.slice(stopRef.lastIndexOf(":") + 1),
		mapTripRef: (tripRef) => tripRef.slice(tripRef.lastIndexOf(":") + 1),
	},
	{
		id: "nantes-zenbus",
		staticResourceHref: "https://zenbus.net/gtfs/static/download.zip?dataset=tan",
		realtimeResourceHrefs: ["https://zenbus.net/gtfs/rt/poll.proto?dataset=tan"],
		mode: "NO-TU",
		getNetworkRef: () => "NAOLIB",
		getVehicleRef: (vehicle) => (vehicle ? nantesZenbusVehicleIdToLabel.get(vehicle.id) : undefined),
		mapLineRef: (lineRef) => lineRef.slice(nthIndexOf(lineRef, ":", 2) + 1, nthIndexOf(lineRef, ":", 3)),
		mapStopRef: (stopRef) => stopRef.slice(nthIndexOf(stopRef, ":", 3) + 1, nthIndexOf(stopRef, ":", 4)),
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
	{
		id: "vendome",
		staticResourceHref: "https://pysae.com/api/v2/groups/vendome/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/vendome/gtfs-rt"],
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
		mode: "NO-TU",
		getNetworkRef: () => "LEVIB",
		getVehicleRef: (vehicle) => vehicle?.label ?? undefined,
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
