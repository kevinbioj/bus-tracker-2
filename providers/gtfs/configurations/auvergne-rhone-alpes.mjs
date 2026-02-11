const montelimarRouteIdConverter = new Map([
	["1", "CAMA_L1"],
	["2", "CAMA_L2"],
	["3", "CAMA_L3"],
	["4", "CAMA_L4"],
	["10", "CAMA_L10"],
	["11", "CAMA_L11"],
	["12", "CAMA_L12"],
	["13", "CAMA_L13"],
	["14", "CAMA_L14"],
	["15", "CAMA_L15"],
	["16", "CAMA_L16"],
	["17", "CAMA_L17"],
	["21", "CAMA_L21"],
	["22", "CAMA_L22"],
	["23", "CAMA_L23"],
	["29", "CAMA_L29"],
	["31", "CAMA_L31"],
	["32", "CAMA_L32"],
	["33", "CAMA_L33"],
	["34", "CAMA_L34"],
	["35", "CAMA_L35"],
	["51", "CAMA_L51"],
	["52", "CAMA_L52"],
	["54", "CAMA_L54"],
	["D", "CAMA_LD"],
	["D1", "CAMA_LD1"],
	["D2", "CAMA_LD2"],
	["D31", "CAMA_LD31"],
	["D34", "CAMA_LD34"],
]);

/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "annecy",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/8b12f6db-9aa7-43dc-a179-013998a1c4c0",
		realtimeResourceHrefs: [],
		getNetworkRef: () => "SIBRA",
	},
	{
		id: "aubenas",
		staticResourceHref:
			"https://app.mecatran.com/utw/ws/gtfsfeed/static/aubenas?apiKey=6527571c533049035b6a0d41252853243b1f2a68",
		realtimeResourceHrefs: ["https://gtfs-rt.infra-hubup.fr/toutenbus/realtime"],
		mode: "NO-TU",
		mapVehiclePosition: (vehicle) => {
			if (/(?:DM|\d{6})-.+/.test(vehicle.trip?.routeId)) {
				vehicle.trip = undefined;
			}

			return vehicle;
		},
		getNetworkRef: () => "AUBENAS",
	},
	{
		id: "aura-e18",
		staticResourceHref: "https://www.data.gouv.fr/api/1/datasets/r/974cede8-3a14-4c7b-b94d-b2655c31932e",
		realtimeResourceHrefs: [
			"https://proxy.transport.data.gouv.fr/resource/montelibus-montelimar-gtfs-rt-trip-update?token=KZL1tb49w8EZODCIq8b3RpI8DKoUB6iV27Cfw_KBoWY",
			"https://proxy.transport.data.gouv.fr/resource/montelibus-montelimar-gtfs-rt-vehicle-position?token=KZL1tb49w8EZODCIq8b3RpI8DKoUB6iV27Cfw_KBoWY",
		],
		mode: "NO-TU",
		excludeScheduled: true,
		getNetworkRef: () => "AURA-07",
		mapVehiclePosition: (vehicle) => {
			if (!vehicle.trip?.routeId?.startsWith("E")) {
				return;
			}

			delete vehicle.position.bearing;
			vehicle.vehicle.id = vehicle.vehicle.label;
			return vehicle;
		},
	},
	{
		id: "aura-express-x73",
		staticResourceHref: "https://pysae.com/api/v2/groups/x73/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/x73/gtfs-rt"],
		mode: "NO-TU",
		getNetworkRef: () => "AURA-EXPRESS",
		getVehicleRef: (vehicle) => vehicle?.label,
	},
	{
		id: "aura-38",
		staticResourceHref: "https://gtfs.bus-tracker.fr/aura-38.zip",
		realtimeResourceHrefs: ["https://www.itinisere.fr/ftp/GtfsRT/GtfsRT.CG38.pb"],
		getNetworkRef: () => "AURA-38",
		getAheadTime: () => 5 * 60,
		mapLineRef: (lineRef) => lineRef.split("-")[0],
	},
	{
		id: "chambery",
		staticResourceHref:
			"https://mwe.mecatran.com/utw/ws/gtfsfeed/static/chambery?apiKey=223f2f102c1242570d3f0231326a271940774f72&type=gtfs_urbain",
		realtimeResourceHrefs: ["https://proxy.transport.data.gouv.fr/resource/synchrobus-chambery-gtfs-rt-trip-update"],
		getNetworkRef: () => "SYNCHRO",
	},
	{
		id: "chamonix",
		staticResourceHref: "https://pysae.com/api/v2/groups/chamonix-bus/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/chamonix-bus/gtfs-rt"],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		mode: "NO-TU",
		excludeScheduled: true,
		getNetworkRef: () => "CHAMONIX",
		getVehicleRef: (vehicle) => vehicle?.label ?? undefined,
	},
	{
		id: "clermont-f",
		staticResourceHref: "https://gtfs.bus-tracker.fr/clermont-ferrand.zip",
		realtimeResourceHrefs: [
			"https://proxy.transport.data.gouv.fr/resource/t2c-clermont-gtfs-rt-trip-update?token=KZL1tb49w8EZODCIq8b3RpI8DKoUB6iV27Cfw_KBoWY",
		],
		getNetworkRef: () => "T2C",
	},
	{
		id: "cluses",
		staticResourceHref: "https://www.data.gouv.fr/api/1/datasets/r/0602751c-36aa-445d-88e2-aa4c51c13205",
		realtimeResourceHrefs: [],
		getNetworkRef: () => "ARVI",
	},
	{
		id: "evian",
		staticResourceHref: "https://www.data.gouv.fr/api/1/datasets/r/429c8587-676a-4ed3-8279-e67403bc36f4",
		realtimeResourceHrefs: [
			"https://evad.nuamouv.com/tempsreel/api/gtfs-rt/trip_update",
			"https://evad.nuamouv.com/tempsreel/api/gtfs-rt/vehicle_position",
		],
		mode: "NO-TU",
		excludeScheduled: true,
		getNetworkRef: () => "EVIAN",
		mapLineRef: (lineRef) => lineRef.split("-")[0],
	},
	{
		id: "grenoble",
		staticResourceHref: "https://data.mobilites-m.fr/api/gtfs/SEM",
		realtimeResourceHrefs: [],
		getNetworkRef: () => "TAG",
	},
	{
		id: "montelimar",
		staticResourceHref: "https://www.data.gouv.fr/api/1/datasets/r/974cede8-3a14-4c7b-b94d-b2655c31932e",
		realtimeResourceHrefs: [
			"https://proxy.transport.data.gouv.fr/resource/montelibus-montelimar-gtfs-rt-trip-update?token=KZL1tb49w8EZODCIq8b3RpI8DKoUB6iV27Cfw_KBoWY",
			"https://proxy.transport.data.gouv.fr/resource/montelibus-montelimar-gtfs-rt-vehicle-position?token=KZL1tb49w8EZODCIq8b3RpI8DKoUB6iV27Cfw_KBoWY",
		],
		mode: "NO-TU",
		excludeScheduled: true,
		getNetworkRef: () => "MONTELIMAR",
		mapTripUpdate: (tripUpdate) => {
			tripUpdate.trip.tripId = tripUpdate.trip.tripId.split("--")[0];
			if (tripUpdate.trip.routeId && montelimarRouteIdConverter.has(tripUpdate.trip.routeId)) {
				tripUpdate.trip.routeId = montelimarRouteIdConverter.get(tripUpdate.trip.routeId);
			}

			return tripUpdate;
		},
		mapVehiclePosition: (vehicle) => {
			if (vehicle.trip?.routeId?.startsWith("E")) {
				return;
			}

			delete vehicle.position.bearing;
			vehicle.vehicle.id = vehicle.vehicle.label;

			if (vehicle.trip) {
				vehicle.trip.tripId = vehicle.trip.tripId.split("--")[0];
				if (vehicle.trip.routeId && montelimarRouteIdConverter.has(vehicle.trip.routeId)) {
					vehicle.trip.routeId = montelimarRouteIdConverter.get(vehicle.trip.routeId);
				}
			}

			return vehicle;
		},
	},
	{
		id: "morzine-avoriaz",
		staticResourceHref: "https://pysae.com/api/v2/groups/skibus_morzine-avoriaz/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/skibus_morzine-avoriaz/gtfs-rt"],
		mode: "NO-TU",
		getNetworkRef: () => "MORZINE-AVORIAZ",
		getVehicleRef: (vehicle) => vehicle?.label,
	},
	{
		id: "porte-isere",
		staticResourceHref: "https://pysae.com/api/v2/groups/keolis-9cc4/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/keolis-9cc4/gtfs-rt"],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: () => "RUBAN",
		getVehicleRef: (vehicle) => vehicle?.label ?? undefined,
		getDestination: (journey) => journey?.trip?.headsign?.replace(`LIGNE ${journey?.trip?.route.name} - `, ""),
	},
	{
		id: "st-die-des-vosges",
		staticResourceHref: "https://pysae.com/api/v2/groups/saint-die-des-vosges/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/saint-die-des-vosges/gtfs-rt"],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: () => "ST-DIE-DES-VOSGES",
		getVehicleRef: (vehicle) => vehicle?.label ?? undefined,
	},
	{
		id: "st-etienne",
		staticResourceHref: "https://api.stas3.cityway.fr/dataflow/offre-tc/download?provider=STAS&dataFormat=GTFS",
		realtimeResourceHrefs: [
			"https://api.stas3.cityway.fr/dataflow/horaire-tc-tr/download?provider=STAS&dataFormat=GTFS-RT",
			"https://api.stas3.cityway.fr/dataflow/vehicule-tc-tr/download?provider=STAS&dataFormat=GTFS-RT",
		],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: () => "STAS",
		getDestination: (journey) => journey?.calls.findLast((call) => call.status !== "SKIPPED")?.stop.name,
	},
	{
		id: "valence",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/46bf6b5c-68c1-4198-a982-caeee88540a3",
		realtimeResourceHrefs: [
			"https://proxy.transport.data.gouv.fr/resource/citea-valence-gtfs-rt-vehicle-position",
			"https://proxy.transport.data.gouv.fr/resource/citea-valence-gtfs-rt-trip-update",
		],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: () => "CITEA",
	},
	{
		id: "valloire",
		staticResourceHref: "https://pysae.com/api/v2/groups/valloire/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/valloire/gtfs-rt"],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: () => "VALLOIRE",
		getVehicleRef: (vehicle) => vehicle?.label,
	},
	{
		id: "vichy",
		staticResourceHref: "https://www.data.gouv.fr/api/1/datasets/r/4653683f-48a6-4f84-b313-058687fc5d04",
		realtimeResourceHrefs: [
			"https://gtfs.bus-tracker.fr/gtfs-rt/vichy/trip-updates",
			"https://gtfs.bus-tracker.fr/gtfs-rt/vichy/vehicle-positions",
		],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		mode: "NO-TU",
		excludeScheduled: true,
		getNetworkRef: () => "MOBIVIE",
		getVehicleRef: (vehicle) => vehicle?.id,
		getDestination: (journey, vehicle) => vehicle?.label ?? journey?.trip.headsign,
		mapLineRef: (lineRef) => lineRef.split("-")[0],
	},
	{
		id: "vienne",
		staticResourceHref:
			"https://s3.eu-west-1.amazonaws.com/files.orchestra.ratpdev.com/networks/vienne-mobi/exports/medias.zip",
		realtimeResourceHrefs: ["https://feed-vienne-mobi.ratpdev.com/GTFS-RT/gtfs-rt.bin"],
		mode: "NO-TU",
		getNetworkRef: () => "VIENNE",
		getVehicleRef: (vehicle) => vehicle?.label,
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
