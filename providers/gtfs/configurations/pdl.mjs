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
	["zenbus:Vehicle:6490944494895104:LOC", "1045"],
	["zenbus:Vehicle:5138349385842688:LOC", "1050"],
	// ["zenbus:Vehicle:4918306319368192:LOC", "1052"], // old Zenbus tablet id
	["zenbus:Vehicle:4890796839927808:LOC", "1052"],
	["zenbus:Vehicle:4883724853313536:LOC", "1053"],
	["zenbus:Vehicle:5200553242001408:LOC", "1054"],
	["zenbus:Vehicle:5132913748213760:LOC", "1057"],
	["zenbus:Vehicle:4867052192923648:LOC", "1058"],
	["zenbus:Vehicle:4801682455134208:LOC", "1059"],
	["zenbus:Vehicle:895000002:LOC", "1061"],
	["zenbus:Vehicle:5122400943341568:LOC", "1062"],
	["zenbus:Vehicle:892980002:LOC", "1064"],
	["zenbus:Vehicle:4848532587544576:LOC", "1071"],
	["zenbus:Vehicle:880900025:LOC", "1073"],
	["zenbus:Vehicle:897200002:LOC", "1074"],
	["zenbus:Vehicle:905030002:LOC", "1080"],
	["zenbus:Vehicle:885170002:LOC", "1084"],
	["zenbus:Vehicle:909310002:LOC", "1085"],
	["zenbus:Vehicle:5182534931447808:LOC", "1086"],
	["zenbus:Vehicle:892890033:LOC", "1087"],
	["zenbus:Vehicle:901640003:LOC", "1088"],
	["zenbus:Vehicle:5095547666956288:LOC", "1089"],
	["zenbus:Vehicle:900880003:LOC", "1090"],
	["zenbus:Vehicle:882910002:LOC", "1091"],
	["zenbus:Vehicle:5130500127588352:LOC", "1092"],
	["zenbus:Vehicle:4826052418338816:LOC", "1093"],
	["zenbus:Vehicle:5088398328987648:LOC", "1094"],
	["zenbus:Vehicle:4848286935547904:LOC", "1095"],
	["zenbus:Vehicle:886860002:LOC", "1100"],
	["zenbus:Vehicle:900890002:LOC", "1101"],
	["zenbus:Vehicle:900940030:LOC", "1102"],
	["zenbus:Vehicle:880900026:LOC", "1103"],
	["zenbus:Vehicle:4895557152669696:LOC", "1104"],
	["zenbus:Vehicle:912870002:LOC", "1105"],
	["zenbus:Vehicle:5173084644442112:LOC", "1106"],
	["zenbus:Vehicle:5193131202969600:LOC", "1108"],
	["zenbus:Vehicle:892890034:LOC", "1109"],
	["zenbus:Vehicle:4902176938786816:LOC", "1110"],
	["zenbus:Vehicle:5201965212499968:LOC", "1111"],
	["zenbus:Vehicle:6267566504804352:LOC", "1112"],
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
		],
		gtfsOptions: { shapesStrategy: "IGNORE" }, // shape distances unavailable
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: (journey) => journey?.trip?.route.agency.id.replace("_", "-") ?? "ALEOP",
		getVehicleRef: (descriptor) => {
			const label = descriptor?.label;

			// We filter out shitness
			if (typeof label === "undefined") return;
			if (label.includes("→") || label.includes(">")) return;
			if (/\d/.exec(label) === null) return;

			// Some (same) parc numbers are used by different operators in the same network 🤦
			// so we use licensePlate which should always be here, but still label if not
			if (+label >= 217 && +label <= 226 && +label !== 224) return descriptor.licensePlate ?? descriptor.label;

			// 5 vehicles are identified by their number or by their license plate depending on the Moon's phase
			const normalizedLicensePlate = (
				typeof descriptor.licensePlate === "undefined" ||
				(+descriptor.licensePlate >= 1 && +descriptor.licensePlate <= 5)
					? descriptor.label
					: descriptor.licensePlate
			).replace(/[- ]/g, "");
			if (
				typeof normalizedLicensePlate !== "undefined" &&
				["DJ328QV", "DJ359QV", "DJ384QV", "DJ394QV"].includes(normalizedLicensePlate)
			) {
				return normalizedLicensePlate;
			}

			return label;
		},
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
			shapesStrategy: "IGNORE",
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
		gtfsOptions: { shapesStrategy: "IGNORE" },
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: () => "IRIGO",
		getVehicleRef: (descriptor) => {
			if (Number.isNaN(+descriptor?.label?.trim())) return undefined;
			return +descriptor?.label?.trim();
		},
	},
	{
		id: "cholet",
		staticResourceHref:
			"https://app.mecatran.com/utw/ws/gtfsfeed/static/choletbus?apiKey=0b0f0b6035007b7f1243311973401c294e6a0143",
		realtimeResourceHrefs: [
			"https://app.mecatran.com/utw/ws/gtfsfeed/realtime/choletbus?apiKey=0b0f0b6035007b7f1243311973401c294e6a0143",
		],
		getNetworkRef: () => "CHOLETBUS",
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
		gtfsOptions: { shapesStrategy: "IGNORE" },
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: () => "NAOLIB",
		getVehicleRef: (vehicle) => (vehicle ? nantesZenbusVehicleIdToLabel.get(vehicle.id) : undefined),
		mapLineRef: (lineRef) => lineRef.slice(nthIndexOf(lineRef, ":", 2) + 1, nthIndexOf(lineRef, ":", 3)),
		mapStopRef: (stopRef) => stopRef.slice(nthIndexOf(stopRef, ":", 3) + 1, nthIndexOf(stopRef, ":", 4)),
	},
	{
		id: "roche-sur-yon",
		staticResourceHref: "https://gtfs-rt.infra-hubup.fr/impulsyon/current/revision/gtfs",
		realtimeResourceHrefs: ["https://gtfs-rt.infra-hubup.fr/impulsyon/realtime"],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		mode: "NO-TU",
		getNetworkRef: () => "IMPULSYON",
		getVehicleRef: (vehicle) => vehicle?.label,
		getDestination: (journey) => journey?.calls.findLast((call) => call.status !== "SKIPPED")?.stop.name,
	},
	{
		id: "saumur",
		staticResourceHref: "https://mobi-iti-pdl.okina.fr/static/mobiiti_saumur_val_de_loire/gtfs_imported-id_saumur.zip",
		realtimeResourceHrefs: [],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		getNetworkRef: () => "OGALO",
		getDestination: (journey) => journey?.calls.at(-1)?.stop.name,
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
