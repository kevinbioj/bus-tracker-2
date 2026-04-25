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

const gpsoZenbusIdToVehicleLabel = new Map([
	["887490002", "0066"],
	["30020052", "0067"],
	["222640001", "0068"],
	["886400002", "0483"],
	["218410002", "0487"],
	["214760001", "0488"],
	["240420002", "0529"],
	["226790001", "0821"],
	["258800001", "0822"],
]);

const saclayZenbusIdToVehicleLabel = new Map();

/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "idfm",
		staticResourceHref: "https://gtfs.bus-tracker.fr/idfm.zip",
		realtimeResourceHrefs: ["http://gtfsidfm.clarifygdps.com/gtfs-rt-trips-idfm"],
		gtfsOptions: {
			filterTrips: (trip) => {
				if (trip.route.agency.id === "IDFM:Operator_1041") {
					trip.route.agency.id = "IDFM:1086";
				}

				if (trip.route.agency.id === "IDFM:Operator_1004") {
					trip.route.agency.id = "IDFM:1047";
				}

				if (trip.route.agency.id === "IDFM:Operator_1032") {
					trip.route.agency.id = "IDFM:1065";
				}

				if (trip.route.name === "TER") return false;

				if (trip.route.agency.id === "IDFM:885") {
					// Paris-Saclay Mobilités
					return false;
				}

				if (trip.route.agency.id === "IDFM:1088") {
					// Grand Paris Seine Ouest
					return false;
				}

				if (trip.route.agency.id === "IDFM:Operator_1044") {
					trip.route.agency.id = "IDFM:1088";
				}

				if (trip.route.agency.id === "IDFM:Operator_334") {
					// Autocars Dominique pour la Traverse
					return false;
				}

				if (trip.route.agency.id === "IDFM:1064") {
					// Vallée Sud Grand Paris
					return false;
				}

				if (
					trip.route.agency.id === "IDFM:1051" &&
					["IDFM:C00275" /* 6570 */, "IDFM:C02805" /* 6582 */].includes(trip.route.id)
				) {
					// Poissy – Les Mureaux (lignes 6570 et 6582 uniquement)
					return false;
				}

				if (trip.route.agency.id === "IDFM:1054" && ["IDFM:C02629" /* N */].includes(trip.route.id)) {
					// Argenteuil – Boucles de Seine (ligne N uniquement)
					return false;
				}

				return true;
			},
		},
		getAheadTime: (journey) => (journey.trip?.route.type === "RAIL" ? 5 * 60 : 60),
		getNetworkRef: (journey) => journey?.trip.route.agency.id,
		getVehicleRef: () => undefined,
	},
	{
		id: "gpso",
		staticResourceHref: "https://zenbus.net/gtfs/static/download.zip?dataset=gpso-rt",
		realtimeResourceHrefs: ["https://zenbus.net/gtfs/rt/poll.proto?dataset=gpso-rt"],
		mode: "NO-TU",
		excludeScheduled: true,
		getNetworkRef: () => "IDFM:1088",
		getVehicleRef: (vehicle) =>
			vehicle
				? gpsoZenbusIdToVehicleLabel.get(
						vehicle.id.slice(nthIndexOf(vehicle.id, ":", 2) + 1, nthIndexOf(vehicle.id, ":", 3)),
					)
				: undefined,
		mapLineRef: (lineRef) => lineRef.slice(nthIndexOf(lineRef, ":", 2) + 1, nthIndexOf(lineRef, ":", 3)),
		mapStopRef: (stopRef) => stopRef.slice(nthIndexOf(stopRef, ":", 3) + 1, nthIndexOf(stopRef, ":", 4)),
	},
	{
		id: "saclay",
		staticResourceHref: "https://zenbus.net/gtfs/static/download.zip?dataset=caee",
		realtimeResourceHrefs: ["https://zenbus.net/gtfs/rt/poll.proto?dataset=caee"],
		mode: "NO-TU",
		excludeScheduled: true,
		getNetworkRef: () => "IDFM:885",
		getVehicleRef: (vehicle) =>
			vehicle
				? saclayZenbusIdToVehicleLabel.get(
						vehicle.id.slice(nthIndexOf(vehicle.id, ":", 2) + 1, nthIndexOf(vehicle.id, ":", 3)),
					)
				: undefined,
		mapLineRef: (lineRef) => lineRef.slice(nthIndexOf(lineRef, ":", 2) + 1, nthIndexOf(lineRef, ":", 3)),
		mapStopRef: (stopRef) => stopRef.slice(nthIndexOf(stopRef, ":", 3) + 1, nthIndexOf(stopRef, ":", 4)),
	},
	{
		id: "clichy",
		staticResourceHref: "https://pysae.com/api/v2/groups/clichy/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/clichy/gtfs-rt"],
		mode: "NO-TU",
		excludeScheduled: true,
		getNetworkRef: () => "CLICHY",
		getVehicleRef: (vehicle) => vehicle?.label,
	},
	{
		id: "houilles",
		staticResourceHref: "https://pysae.com/api/v2/groups/keolis-ph48/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/keolis-ph48/gtfs-rt"],
		mode: "NO-TU",
		excludeScheduled: true,
		mapLineRef: (lineRef) => `KEOLIS-PH48_${lineRef}`,
		getNetworkRef: () => "IDFM:1054",
		getOperatorRef: () => "KEOLIS-PH48",
		getVehicleRef: (vehicle) => vehicle?.label,
	},
	{
		id: "traverse-brancion-commerce",
		staticResourceHref: "https://pysae.com/api/v2/groups/traverse-brancion-commerce/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/traverse-brancion-commerce/gtfs-rt"],
		mode: "NO-TU",
		excludeScheduled: true,
		getNetworkRef: () => "TRAVERSE-BRANCION-COMMERCE",
		getVehicleRef: (vehicle) => vehicle?.label,
	},
	{
		id: "keolis-seine-oise-est",
		staticResourceHref: "https://api.pysae.com/api/v4/groups/keolis-seine-oise-est-8Bw7/gtfs/pub",
		realtimeResourceHrefs: ["https://api.pysae.com/api/v4/groups/keolis-seine-oise-est-8Bw7/gtfs-rt"],
		mode: "NO-TU",
		excludeScheduled: true,
		mapLineRef: (lineRef) => `KSOE_${lineRef}`,
		getNetworkRef: () => "IDFM:1051",
		getOperatorRef: () => "KSOE",
		getVehicleRef: (vehicle) => vehicle?.label,
	},
	{
		id: "transdev-vallee-sud",
		staticResourceHref: "https://pysae.com/api/v2/groups/Transdev-Cr92/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/Transdev-Cr92/gtfs-rt"],
		mode: "NO-TU",
		excludeScheduled: true,
		getNetworkRef: () => "IDFM:1064",
		getVehicleRef: (vehicle) => vehicle?.label,
	},
];

/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
	id: "idf",
	computeDelayMs: 30_000,
	sources,
};

export default configuration;
