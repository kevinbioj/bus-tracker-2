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
		getNetworkRef: () => "AUBENAS",
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
		mode: "NO-TU",
		excludeScheduled: true,
		getNetworkRef: () => "CHAMONIX",
		getVehicleRef: (vehicle) => vehicle?.label ?? undefined,
	},
	{
		id: "clermont-f",
		staticResourceHref:
			"https://opendata.clermontmetropole.eu/api/v2/catalog/datasets/gtfs-smtc/alternative_exports/gtfs",
		realtimeResourceHrefs: [
			"https://opendata.clermontmetropole.eu/explore/dataset/gtfsrt_tripupdates/files/2c6b5c63d7be78905779d28500e6ab7e/download/",
		],
		getNetworkRef: () => "T2C",
	},
	{
		id: "grenoble",
		staticResourceHref: "https://data.mobilites-m.fr/api/gtfs/SEM",
		realtimeResourceHrefs: [],
		getNetworkRef: () => "TAG",
	},
	{
		id: "porte-isere",
		staticResourceHref: "https://pysae.com/api/v2/groups/keolis-9cc4/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/keolis-9cc4/gtfs-rt"],
		mode: "NO-TU",
		getNetworkRef: () => "RUBAN",
		getVehicleRef: (vehicle) => vehicle?.label ?? undefined,
		getDestination: (journey) => journey?.trip?.headsign?.replace(`LIGNE ${journey?.trip?.route.name} - `, ""),
	},
	{
		id: "st-etienne",
		staticResourceHref: "https://api.stas3.cityway.fr/dataflow/offre-tc/download?provider=STAS&dataFormat=GTFS",
		realtimeResourceHrefs: [
			"https://api.stas3.cityway.fr/dataflow/horaire-tc-tr/download?provider=STAS&dataFormat=GTFS-RT",
			"https://api.stas3.cityway.fr/dataflow/vehicule-tc-tr/download?provider=STAS&dataFormat=GTFS-RT",
		],
		mode: "NO-TU",
		getNetworkRef: () => "STAS",
		getDestination: (journey) => journey?.calls.findLast((call) => call.status !== "SKIPPED")?.stop.name,
	},
	{
		id: "tcl-metro",
		staticResourceHref:
			"https://gtech-transit-prod.apigee.net/v1/google/gtfs/odbl/lyon_tcl.zip?apikey=BasyG6OFZXgXnzWdQLTwJFGcGmeOs204&secret=gNo6F5PhQpsGRBCK",
		realtimeResourceHrefs: [],
		gtfsOptions: {
			filterTrips: (trip) => trip.route.type === "SUBWAY",
		},
		getNetworkRef: () => "TCL",
		getAheadTime: () => 60,
	},
	{
		id: "tcl-rhone-express",
		staticResourceHref:
			"https://api.oura3.cityway.fr/dataflow/offre-tc/download?provider=SYTRAL_RHONE_EXPRESS&dataFormat=GTFS",
		realtimeResourceHrefs: [
			"https://api.oura3.cityway.fr/dataflow/horaire-tr/download?provider=SYTRAL_RHONE_EXPRESS&dataFormat=GTFS-RT",
		],
		getNetworkRef: () => "TCL",
		getAheadTime: () => 120,
	},
	{
		id: "villefranche-s-saone",
		staticResourceHref:
			"https://gtech-transit-prod.apigee.net/v1/google/gtfs/odbl/lyon_libellule.zip?apikey=BasyG6OFZXgXnzWdQLTwJFGcGmeOs204&secret=gNo6F5PhQpsGRBCK",
		realtimeResourceHrefs: [],
		getNetworkRef: () => "LILEBLLULE",
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
