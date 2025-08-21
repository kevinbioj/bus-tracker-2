/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	// {
	// 	id: "avignon",
	// 	staticResourceHref: "https://exs.tcra2.cityway.fr/gtfs.aspx?key=UID&operatorCode=TCRA",
	// 	realtimeResourceHrefs: ["https://export.tcra2.cityway.fr/GtfsRt/GtfsRT.TCRA.pb"],
	// 	gtfsOptions: { shapesStrategy: "IGNORE" },
	// 	excludeScheduled: true,
	// 	getNetworkRef: () => "ORIZO",
	// },
	{
		id: "cannes",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/47bc8088-6c72-43ad-a959-a5bbdd1aa14f",
		realtimeResourceHrefs: [
			"https://proxy.transport.data.gouv.fr/resource/palmbus-cannes-gtfs-rt-vehicle-position",
			"https://proxy.transport.data.gouv.fr/resource/palmbus-cannes-gtfs-rt-trip-update",
		],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		excludeScheduled: true,
		getNetworkRef: () => "PALMBUS",
	},
	{
		id: "gap",
		staticResourceHref: "https://gtfs-rt.infra-hubup.fr/cagtd/current/revision/gtfs",
		realtimeResourceHrefs: ["https://gtfs-rt.infra-hubup.fr/cagtd/realtime"],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		excludeScheduled: true,
		mode: "NO-TU",
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
		gtfsOptions: { shapesStrategy: "IGNORE" },
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
			"https://transport.data.gouv.fr/resources/80732/download",
			"https://transport.data.gouv.fr/resources/80731/download",
		],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: () => "TANGO",
		mapTripUpdate: (tripUpdate) => {
			for (const stopTimeUpdate of tripUpdate.stopTimeUpdate) {
				stopTimeUpdate.stopId = stopTimeUpdate.stopId.slice(stopTimeUpdate.stopId.indexOf(":") + 1);
			}
			return tripUpdate;
		},
	},
	{
		id: "toulon",
		staticResourceHref:
			"https://s3.eu-west-1.amazonaws.com/files.orchestra.ratpdev.com/networks/rd-toulon/exports/gtfs-complet.zip",
		realtimeResourceHrefs: [
			"https://feed-rdtpm-toulon.ratpdev.com/VehiclePosition/GTFS-RT",
			"https://feed-rdtpm-toulon.ratpdev.com/TripUpdate/GTFS-RT",
		],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		mode: "NO-TU",
		excludeScheduled: true,
		getNetworkRef: () => "MISTRAL",
		getVehicleRef: (vehicleDescriptor) => vehicleDescriptor?.label?.padStart(3, "0"),
	},
	{
		id: "zou-proximite",
		staticResourceHref: "https://www.datasud.fr/fr/dataset/datasets/3745/resource/5016/download/",
		realtimeResourceHrefs: [
			"https://proxy.transport.data.gouv.fr/resource/region-sud-zou-proximite-gtfs-rt-trip-update",
		],
		excludeScheduled: true,
		getNetworkRef: () => "ZOU",
		getVehicleRef: (descriptor) => +descriptor?.label || undefined,
	},
	{
		id: "zou-express",
		staticResourceHref: "https://www.datasud.fr/fr/dataset/datasets/3743/resource/5153/download/",
		realtimeResourceHrefs: ["https://proxy.transport.data.gouv.fr/resource/region-sud-zou-express-gtfs-rt-trip-update"],
		excludeScheduled: true,
		getNetworkRef: () => "ZOU",
		getVehicleRef: (descriptor) => +descriptor?.label || undefined,
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
