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
	{
		id: "avignon",
		staticResourceHref: "https://api.maas-fr.cityway.fr/dataflow/offre-tc/download?provider=ORIZO&dataFormat=GTFS",
		realtimeResourceHrefs: [
			"https://api.maas-fr.cityway.fr/dataflow/vehicule-tc-tr/download?provider=ORIZO&dataFormat=GTFS-RT",
			"https://api.maas-fr.cityway.fr/dataflow/horaire-tc-tr/download?provider=ORIZO&dataFormat=GTFS-RT",
		],
		mode: "NO-TU",
		getNetworkRef: () => "ORIZO",
	},
	{
		id: "briancon",
		staticResourceHref: "https://www.data.gouv.fr/api/1/datasets/r/3ee23301-f454-4175-ba53-4734c30d5245",
		realtimeResourceHrefs: [],
		gtfsOptions: { computeShapeDistTraveled: "always" },
		getNetworkRef: () => "BRIANCON",
	},
	{
		id: "cannes",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/47bc8088-6c72-43ad-a959-a5bbdd1aa14f",
		realtimeResourceHrefs: [
			"https://proxy.transport.data.gouv.fr/resource/palmbus-cannes-gtfs-rt-vehicle-position",
			"https://proxy.transport.data.gouv.fr/resource/palmbus-cannes-gtfs-rt-trip-update",
		],
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: () => "PALMBUS",
	},
	{
		id: "cavaillon",
		staticResourceHref: "https://pysae.com/api/v2/groups/cavaillon/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/cavaillon/gtfs-rt"],
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: () => "CAVAILLON",
		getVehicleRef: (vehicle) => vehicle?.label,
		mapLineRef: (lineRef) => lineRef.slice(nthIndexOf(lineRef, ":", 2) + 1, nthIndexOf(lineRef, ":", 3)),
	},
	{
		id: "digne-les-bains",
		staticResourceHref: "https://www.data.gouv.fr/api/1/datasets/r/0d9ebca0-d18e-44ad-ab95-d89e8a72d781",
		realtimeResourceHrefs: [],
		gtfsOptions: { computeShapeDistTraveled: "always" },
		getNetworkRef: () => "DIGNE-LES-BAINS",
		getDestination: (journey) => journey?.calls.findLast((call) => call.status !== "SKIPPED")?.stop.name,
	},
	{
		id: "draguignan",
		staticResourceHref: "https://pysae.com/api/v2/groups/draguignan/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/draguignan/gtfs-rt"],
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: () => "DRAGUIGNAN",
		getVehicleRef: (vehicle) => vehicle?.label,
	},
	{
		id: "durance-luberon-verdon",
		staticResourceHref: "https://www.datasud.fr/fr/dataset/datasets/3941/resource/5123/download/",
		realtimeResourceHrefs: [],
		gtfsOptions: { computeShapeDistTraveled: "always", filterTrips: (trip) => !trip.route.name.startsWith("PMR") },
		getNetworkRef: () => "DURANCE-LUBERON-VERDON",
	},
	{
		id: "esterel",
		staticResourceHref: "https://api.pysae.com/api/v4/groups/agglobus-cavem/gtfs/pub",
		realtimeResourceHrefs: ["https://api.pysae.com/api/v4/groups/agglobus-cavem/gtfs-rt"],
		gtfsOptions: { computeShapeDistTraveled: "always" },
		mode: "NO-TU",
		getNetworkRef: () => "ESTEREL",
		getVehicleRef: (vehicle) => vehicle?.label,
	},
	{
		id: "gap",
		staticResourceHref: "https://gtfs-rt.infra-hubup.fr/cagtd/current/gtfs",
		realtimeResourceHrefs: ["https://gtfs-rt.infra-hubup.fr/cagtd/realtime"],
		gtfsOptions: { computeShapeDistTraveled: "always" },
		mode: "NO-TU",
		mapVehiclePosition: (vehicle) => {
			if (/(?:DM|\d{6})-.+/.test(vehicle.trip?.routeId)) {
				vehicle.trip = undefined;
			}

			return vehicle;
		},
		getNetworkRef: () => "GAP",
		getVehicleRef: (vehicle) => vehicle?.label,
	},
	{
		id: "menton",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/72609821-2459-47fb-a63b-3dbbc0d96c92",
		realtimeResourceHrefs: [
			"https://proxy.transport.data.gouv.fr/resource/zest-menton-riviera-gtfs-rt-trip-update",
			"https://proxy.transport.data.gouv.fr/resource/zest-menton-riviera-gtfs-rt-vehicle-position",
		],
		excludeScheduled: true,
		mode: "NO-TU",
		mapVehiclePosition: (vehicle) => {
			vehicle.vehicle.id = vehicle.vehicle.label;
			return vehicle;
		},
		getNetworkRef: () => "ZESTBUS",
	},
	{
		id: "nice",
		staticResourceHref: "https://chouette.enroute.mobi/api/v1/datas/OpendataRLA/gtfs.zip",
		realtimeResourceHrefs: [
			"https://ara-api.enroute.mobi/rla/gtfs/trip-updates",
			"https://ara-api.enroute.mobi/rla/gtfs/vehicle-positions",
		],
		mode: "NO-TU",
		getNetworkRef: () => "LIGNES-AZUR",
	},
	{
		id: "nimes",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/15aeb8a5-1cca-4bb9-ae5f-b6e67e4ff2ab",
		realtimeResourceHrefs: [
			"https://gtfs.bus-tracker.fr/gtfs-rt/tango/trip-updates",
			"https://gtfs.bus-tracker.fr/gtfs-rt/tango/vehicle-positions",
		],
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: () => "TANGO",
	},
	{
		id: "pays-ecrins",
		staticResourceHref: "https://pysae.com/api/v4/groups/pays-des-ecrins/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v4/groups/pays-des-ecrins/gtfs-rt"],
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: () => "PAYS-ECRINS",
		getVehicleRef: (vehicle) => vehicle?.label,
	},
	{
		id: "toulon",
		staticResourceHref:
			"https://s3.eu-west-1.amazonaws.com/files.orchestra.ratpdev.com/networks/rd-toulon/exports/gtfs-complet.zip",
		realtimeResourceHrefs: [
			"https://feed-rdtpm-toulon.ratpdev.com/VehiclePosition/GTFS-RT",
			"https://feed-rdtpm-toulon.ratpdev.com/TripUpdate/GTFS-RT",
		],
		mode: "NO-TU",
		excludeScheduled: true,
		getNetworkRef: () => "MISTRAL",
		getVehicleRef: (vehicleDescriptor) => vehicleDescriptor?.label?.padStart(3, "0"),
	},
	{
		id: "toulon-telepherique",
		staticResourceHref: "https://www.data.gouv.fr/api/1/datasets/r/9bba0b17-2863-4ee1-a38a-c7a445f820d1",
		realtimeResourceHrefs: [],
		getNetworkRef: () => "MISTRAL",
	},
	{
		id: "transdev-trsi",
		staticResourceHref: "https://gtfs.bus-tracker.fr/transdev-trsi.zip",
		realtimeResourceHrefs: ["https://www.data.gouv.fr/api/1/datasets/r/74db080b-3d7c-4f30-8811-b344e79f4092"],
		hasRealVehicles: false,
		getNetworkRef: () => "TRSI",
		getVehicleRef: (_, journey) => journey?.trip.id.split("@")[0],
		getDestination: (journey) => journey?.calls.findLast((call) => call.status !== "SKIPPED")?.stop.name,
		mapTripUpdate: (tripUpdate) => {
			tripUpdate.vehicle = undefined;
			return tripUpdate;
		},
	},
	{
		id: "zou-proximite",
		staticResourceHref: "https://www.datasud.fr/fr/dataset/datasets/3745/resource/5016/download/",
		realtimeResourceHrefs: ["https://proxy-data.zou.maregionsud.fr/GTFS-RT/GTFS-RT_trips_ZOU_proximite.pb"],
		gtfsOptions: { computeShapeDistTraveled: "always" },
		getNetworkRef: () => "ZOU",
		mapLineRef: (lineRef) => lineRef.replace("ZOP:", ""),
	},
	{
		id: "zou-express",
		staticResourceHref: "https://www.datasud.fr/fr/dataset/datasets/3743/resource/5153/download/",
		realtimeResourceHrefs: ["https://proxy-data.zou.maregionsud.fr/GTFS-RT/GTFS-RT_trips_ZOU_express.pb"],
		gtfsOptions: { computeShapeDistTraveled: "always", filterTrips: (trip) => trip.route.agency.id === "EXP" },
		getNetworkRef: () => "ZOU",
		mapLineRef: (lineRef) => lineRef.replace("ZOE:", ""),
	},
];

/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
	id: "paca",
	computeDelayMs: 30_000,
	sources,
};

export default configuration;
