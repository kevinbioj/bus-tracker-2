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

const agdeZenbusVehicles = new Map([
	["zenbus:Vehicle:338850002:LOC", "109335"],
	["zenbus:Vehicle:316640004:LOC", "109334"],
	["zenbus:Vehicle:308550002:LOC", "109337"],
	["zenbus:Vehicle:318570002:LOC", "123036"],
	["zenbus:Vehicle:308550002:LOC", "153065"],
	["zenbus:Vehicle:302650002:LOC", "177017"],
	["zenbus:Vehicle:302660001:LOC", "189115"],
	["zenbus:Vehicle:338850001:LOC", "207014"],
	["zenbus:Vehicle:314610001:LOC", "207015"],
	["zenbus:Vehicle:322530001:LOC", "207017"],
	["zenbus:Vehicle:298720001:LOC", "207018"],
]);

/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "airbus-tlz",
		staticResourceHref: "https://pysae.com/api/v2/groups/airbus-toulouse/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/airbus-toulouse/gtfs-rt"],
		mode: "NO-TU",
		excludeScheduled: true,
		getNetworkRef: () => "AIRBUS-TLZ",
		getVehicleRef: (vehicle) => vehicle?.label ?? undefined,
	},
	{
		id: "agde",
		staticResourceHref: "https://zenbus.net/gtfs/static/download.zip?dataset=agdecapbus68429531",
		realtimeResourceHrefs: ["https://zenbus.net/gtfs/rt/poll.proto?dataset=agdecapbus68429531"],
		maxVehiclePositionAgeMs: 10 * 60_000,
		mode: "VP-ONLY",
		excludeScheduled: true,
		getNetworkRef: () => "CAPBUS",
		getVehicleRef: (vehicle) => (vehicle?.id ? agdeZenbusVehicles.get(vehicle.id) : undefined),
		mapLineRef: (lineRef) => lineRef.slice(nthIndexOf(lineRef, ":", 2) + 1, nthIndexOf(lineRef, ":", 3)),
		mapStopRef: (stopRef) => stopRef.slice(nthIndexOf(stopRef, ":", 3) + 1, nthIndexOf(stopRef, ":", 4)),
	},
	{
		id: "ales",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/b9a0f32e-4386-454c-8759-b82653fa861e",
		realtimeResourceHrefs: [
			"https://alesy.plateforme-2cloud.com/api/gtfsrt/tripupdates/ALESY-6574-4401-7572/bin",
			"https://alesy.plateforme-2cloud.com/api/gtfsrt/vehiclepositions/ALESY-6574-4401-7572/bin",
		],
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: () => "ALESY",
		getVehicleRef: (vehicle) => vehicle?.label,
	},
	{
		id: "arles",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/52216d2f-072e-4b7d-af0c-15d8d4e98b09",
		realtimeResourceHrefs: [
			"https://accm.2cloud.app/api/gtfsrt/2.0/tripupdates/LUMIPLAN-2021-4815-1108/bin",
			"https://accm.2cloud.app/api/gtfsrt/2.0/vehiclepositions/LUMIPLAN-2021-4815-1108/bin",
		],
		mode: "NO-TU",
		excludeScheduled: true,
		getNetworkRef: () => "ENVIA",
	},
	{
		id: "auch",
		staticResourceHref: "https://zenbus.net/gtfs/static/download.zip?dataset=auch-alliance",
		realtimeResourceHrefs: ["https://zenbus.net/gtfs/rt/poll.proto?dataset=auch-alliance"],
		maxVehiclePositionAgeMs: 10 * 60_000,
		mode: "NO-TU",
		excludeScheduled: true,
		getNetworkRef: () => "AUCH",
		getVehicleRef: () => undefined,
		mapLineRef: (lineRef) => lineRef.slice(nthIndexOf(lineRef, ":", 2) + 1, nthIndexOf(lineRef, ":", 3)),
		mapStopRef: (stopRef) => stopRef.slice(nthIndexOf(stopRef, ":", 3) + 1, nthIndexOf(stopRef, ":", 4)),
	},
	{
		id: "beziers",
		staticResourceHref:
			"https://s3.eu-west-1.amazonaws.com/files.orchestra.ratpdev.com/networks/rdbm/exports/gtfs-pour-le-pan.zip",
		realtimeResourceHrefs: [
			"https://feed-beemob-beziers.ratpdev.com/GTFS-RT_tripUpdate/gtfs-rt.bin",
			"https://feed-beemob-beziers.ratpdev.com/GTFS-RT_vehiclePosition/gtfs-rt.bin",
		],
		mode: "NO-TU",
		getNetworkRef: () => "BEEMOB",
		mapVehiclePosition: (vehicle) => {
			vehicle.vehicle.id = vehicle.vehicle.label;
			vehicle.position.bearing = undefined;
			return vehicle;
		},
	},
	{
		id: "castres",
		staticResourceHref: "https://zenbus.net/gtfs/static/download.zip?dataset=castreslignesurbaines",
		realtimeResourceHrefs: ["https://zenbus.net/gtfs/rt/poll.proto?dataset=castreslignesurbaines"],
		maxVehiclePositionAgeMs: 10 * 60_000,
		mode: "NO-TU",
		getNetworkRef: () => "LIBELLUS",
		getVehicleRef: () => undefined,
	},
	{
		id: "lio-global",
		staticResourceHref:
			"https://app.mecatran.com/utw/ws/gtfsfeed/static/lio?apiKey=2b160d626f783808095373766f18714901325e45&type=gtfs_lio",
		realtimeResourceHrefs: [
			"https://lio.2cloud.app/api/gtfsrt/2.0/tripupdates/LIO65-6765-2617-7480/bin",
			"https://lio.2cloud.app/api/gtfsrt/2.0/vehiclepositions/LIO65-6765-2617-7480/bin",
		],
		gtfsOptions: { computeShapeDistTraveled: "always" },
		getNetworkRef: (journey) => {
			if (journey === undefined) return null; // will be ignored
			if (journey.trip.route.id === "NAV_GRAU") return "LIO-30";
			if (journey.trip.route.id === "NAV2_P2V") return "LIO-65";
			if (journey.trip.route.agency.name === "Herault Transport") return "HERAULT-TRANSPORT";
			if (journey.trip.route.agency.name === ".liO 09") return "LIO-09";
			if (journey.trip.route.agency.name === ".liO 11") return "LIO-11";
			if (journey.trip.route.agency.name === ".liO 12") return "LIO-12";
			if (journey.trip.route.agency.name === ".liO 30") return "LIO-30";
			if (journey.trip.route.agency.name === ".liO 31") return "LIO-31";
			if (journey.trip.route.agency.name === ".liO 32") return "LIO-32";
			if (journey.trip.route.agency.name === ".liO 46") return "LIO-46";
			if (journey.trip.route.agency.name === ".liO 48") return "LIO-48";
			if (journey.trip.route.agency.name === ".liO 65") return "LIO-65";
			if (journey.trip.route.agency.name === ".liO 66") return "LIO-66";
			if (journey.trip.route.agency.name === ".liO 81") return "LIO-81";
			if (journey.trip.route.agency.name === ".liO 82") return "LIO-82";
			return null; // will be ignored
		},
		getVehicleRef: (vehicle) => vehicle?.label,
	},
	// {
	// 	id: "lio-gard",
	// 	staticResourceHref: "https://pysae.com/api/v2/groups/lio-gard/gtfs/pub",
	// 	realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/lio-gard/gtfs-rt"],
	// 	excludeScheduled: true,
	// 	mode: "NO-TU",
	// 	mapLineRef: (lineRef) => lineRef.split("|")[0],
	// 	getNetworkRef: () => "LIO-30",
	// 	getVehicleRef: (vehicle) => {
	// 		if (typeof vehicle?.label !== "string") return;
	// 		if (vehicle.label.startsWith("LOT")) return;
	// 		return vehicle.label;
	// 	},
	// },
	// {
	// 	id: "lio-gard-keolis",
	// 	staticResourceHref: "https://pysae.com/api/v2/groups/lio-gard-keolis/gtfs/pub",
	// 	realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/lio-gard-keolis/gtfs-rt"],
	// 	excludeScheduled: true,
	// 	mode: "NO-TU",
	// 	getNetworkRef: () => "LIO-30",
	// 	getVehicleRef: (vehicle) => {
	// 		if (typeof vehicle?.label !== "string") return;
	// 		if (vehicle.label.startsWith("LOT")) return;
	// 		return vehicle.label;
	// 	},
	// },
	// {
	// 	id: "lio-lot",
	// 	staticResourceHref: "https://pysae.com/api/v2/groups/lio-lot/gtfs/pub",
	// 	realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/lio-lot/gtfs-rt"],
	// 	excludeScheduled: true,
	// 	mode: "NO-TU",
	// 	mapLineRef: (lineRef) => lineRef.split("|")[0],
	// 	getNetworkRef: () => "LIO-46",
	// 	getVehicleRef: (vehicle) => {
	// 		if (typeof vehicle?.label !== "string") return;
	// 		if (vehicle.label.startsWith("LOT")) return;
	// 		return vehicle.label;
	// 	},
	// },
	{
		id: "lunel",
		staticResourceHref:
			"https://transport.data.gouv.fr/resources/83852/download?token=KZL1tb49w8EZODCIq8b3RpI8DKoUB6iV27Cfw_KBoWY",
		realtimeResourceHrefs: [
			"https://ole.plateforme-2cloud.com/api/gtfsrt/2.0/vehiclepositions/OLE-2187-9024-3517/bin",
			"https://ole.plateforme-2cloud.com/api/gtfsrt/2.0/tripupdates/OLE-2187-9024-3517/bin",
		],
		mode: "NO-TU",
		getNetworkRef: () => "LUNEL",
		getVehicleRef: (vehicle) => vehicle?.label,
	},
	{
		id: "montpellier",
		staticResourceHref: "https://data.montpellier3m.fr/GTFS/Urbain/GTFS.zip",
		realtimeResourceHrefs: [
			"https://data.montpellier3m.fr/GTFS/Urbain/VehiclePosition.pb",
			"https://data.montpellier3m.fr/GTFS/Urbain/TripUpdate.pb",
		],
		mode: "NO-TU",
		getNetworkRef: () => "TAM",
	},
	{
		id: "montpellier-sub",
		staticResourceHref: "https://data.montpellier3m.fr/GTFS/Suburbain/GTFS.zip",
		realtimeResourceHrefs: [
			"https://data.montpellier3m.fr/GTFS/Suburbain/VehiclePosition.pb",
			"https://data.montpellier3m.fr/GTFS/Suburbain/TripUpdate.pb",
		],
		mode: "NO-TU",
		getNetworkRef: () => "TAM",
	},
	{
		id: "narbonne",
		staticResourceHref:
			"https://s3.eu-west-1.amazonaws.com/files.orchestra.ratpdev.com/networks/narbonne/exports/scolaires-sans-tad.zip",
		realtimeResourceHrefs: ["https://feed-citibus-narbonne.ratpdev.com/GTFS-RT/gtfs-rt.bin"],
		mode: "NO-TU",
		getNetworkRef: () => "NARBONNE",
	},
	{
		id: "pays-or",
		staticResourceHref: "https://www.data.gouv.fr/api/1/datasets/r/84a0902b-ed56-4a09-8eb7-bb58601ba084",
		realtimeResourceHrefs: [
			"https://proxy.transport.data.gouv.fr/resource/transpor-gtfs-rt-trip-update",
			"https://proxy.transport.data.gouv.fr/resource/transpor-gtfs-rt-vehicle-position",
		],
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: () => "TRANSPOR",
		getDestination: (journey) => journey?.calls.at(-1)?.stop.name,
		getVehicleRef: (vehicleDescriptor) => vehicleDescriptor?.label?.replaceAll(" ", ""),
	},
	{
		id: "perpignan",
		staticResourceHref:
			"https://eur.mecatran.com/utw/ws/gtfsfeed/static/perpignan?apiKey=612f606b5e3b0a3e6e1f441a2c4a050f6a345b55",
		realtimeResourceHrefs: [
			"https://eur.mecatran.com/utw/ws/gtfsfeed/vehicles/perpignan?apiKey=612f606b5e3b0a3e6e1f441a2c4a050f6a345b55",
			"https://eur.mecatran.com/utw/ws/gtfsfeed/realtime/perpignan?apiKey=612f606b5e3b0a3e6e1f441a2c4a050f6a345b55",
		],
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: () => "SANKEO",
		getVehicleRef: (vehicle) => vehicle?.label ?? undefined,
	},
	{
		id: "sete",
		staticResourceHref: "https://drive.google.com/uc?export=download&id=1PUISUlg0tpVFTdr7NOzJ2w9KthNXpQNn",
		realtimeResourceHrefs: [
			"https://sete.ceccli.com/gtfs/TripUpdates.pb",
			"https://sete.ceccli.com/gtfs/VehiclePositions.pb",
		],
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: () => "SAM",
		mapVehiclePosition: (vehicle) => (vehicle.trip ? vehicle : undefined),
	},
];

/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
	id: "occitanie",
	computeDelayMs: 30_000,
	sources,
};

export default configuration;
