/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "breizhgo-22",
		staticResourceHref: "https://www.korrigo.bzh/ftp/OPENDATA/BREIZHGO_CAR_22.gtfs.zip",
		realtimeResourceHrefs: ["https://www.korrigo.bzh/ftp/OPENDATA/gtfsrt/TIBUS.GtfsRt.pb"],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		getNetworkRef: () => "BREIZHGO",
	},
	{
		id: "breizhgo-29",
		staticResourceHref: "https://www.korrigo.bzh/ftp/OPENDATA/29.gtfs.zip",
		realtimeResourceHrefs: [
			"https://cat29.geo3d.hanoverdisplays.com/api-1.0/gtfs-rt/trip-updates",
			"https://cat29.geo3d.hanoverdisplays.com/api-1.0/gtfs-rt/vehicle-positions",
		],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		getNetworkRef: () => "BREIZHGO",
	},
	{
		id: "breizhgo-35",
		staticResourceHref: "https://www.korrigo.bzh/ftp/OPENDATA/BREIZHGO_CAR_35.gtfs.zip",
		realtimeResourceHrefs: ["https://www.korrigo.bzh/ftp/OPENDATA/gtfsrt/BREIZHGO_CAR_35.GtfsRt.pb"],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		getNetworkRef: () => "BREIZHGO",
	},
	{
		id: "breizhgo-56",
		staticResourceHref: "https://www.korrigo.bzh/ftp/OPENDATA/BREIZHGO_CAR_56.gtfs.zip",
		gtfsOptions: { shapesStrategy: "IGNORE" },
		getNetworkRef: () => "BREIZHGO",
	},
	{
		id: "breizhgo-ns",
		staticResourceHref: "https://www.transdev-bretagne.com/bzh/open-data/breizhgo-lrr-ns/gtfs",
		gtfsOptions: { shapesStrategy: "IGNORE" },
		getNetworkRef: () => "BREIZHGO",
	},
	{
		id: "breizhgo-rp",
		staticResourceHref: "https://pysae.com/api/v2/groups/breizhgo-lrr/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/breizhgo-lrr/gtfs-rt"],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		getNetworkRef: () => "BREIZHGO",
		getVehicleRef: (vehicle) => vehicle?.label ?? undefined,
	},
	{
		id: "brest",
		staticResourceHref:
			"https://s3.eu-west-1.amazonaws.com/files.orchestra.ratpdev.com/networks/bibus/exports/medias.zip",
		realtimeResourceHrefs: [
			"https://proxy.transport.data.gouv.fr/resource/bibus-brest-gtfs-rt-vehicle-position",
			"https://proxy.transport.data.gouv.fr/resource/bibus-brest-gtfs-rt-trip-update",
		],
		mode: "NO-TU",
		getNetworkRef: () => "BIBUS",
		// "anonymised" vehicle reference 😅🤣
		getVehicleRef: (vehicle) => (vehicle ? +vehicle.id - 2 ** 28 : undefined),
	},
	{
		id: "fougeres",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/665d6c43-598d-4d9d-aa98-206072f4dfa0",
		realtimeResourceHrefs: [
			"https://proxy.transport.data.gouv.fr/resource/surf-fougeres-gtfs-rt-trip-update",
			"https://proxy.transport.data.gouv.fr/resource/surf-fougeres-gtfs-rt-vehicle-position",
		],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		excludeScheduled: true,
		mode: "NO-TU,",
		getNetworkRef: () => "SURF",
	},
	{
		id: "guingamp-paimpol",
		staticResourceHref: "https://www.data.gouv.fr/api/1/datasets/r/52057eec-3786-444c-8696-8473c4c6888e",
		realtimeResourceHrefs: [
			"https://proxy.transport.data.gouv.fr/resource/axeo-guingamp-gtfs-rt-vehicle-position?token=KZL1tb49w8EZODCIq8b3RpI8DKoUB6iV27Cfw_KBoWY",
			"https://proxy.transport.data.gouv.fr/resource/axeo-guingamp-gtfs-rt-trip-update?token=KZL1tb49w8EZODCIq8b3RpI8DKoUB6iV27Cfw_KBoWY",
		],
		mode: "NO-TU",
		getNetworkRef: () => "GUINGAMP-PAIMPOL",
		getVehicleRef: (vehicle) => vehicle?.label,
	},
	{
		id: "lorient",
		staticResourceHref: "https://gtfs.bus-tracker.fr/izilo.zip",
		realtimeResourceHrefs: ["https://feed-rdla-lorient.ratpdev.com/GTFS-RT"],
		getNetworkRef: () => "IZILO",
		getVehicleRef: (vehicle) => vehicle?.label ?? undefined,
	},
	{
		id: "morlaix",
		staticResourceHref: "https://www.korrigo.bzh/ftp/OPENDATA/LINEOTIM_Complet.gtfs.zip",
		realtimeResourceHrefs: [
			"https://gtfs.bus-tracker.fr/gtfs-rt/morlaix/trip-updates",
			"https://gtfs.bus-tracker.fr/gtfs-rt/morlaix/vehicle-positions",
		],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		mode: "NO-TU",
		getNetworkRef: () => "MORLAIX",
		getVehicleRef: (vehicle) => vehicle?.id,
		getDestination: (journey, vehicle) => vehicle?.label ?? journey?.trip.headsign,
	},
	{
		id: "quimper",
		staticResourceHref:
			"https://s3.eu-west-1.amazonaws.com/files.orchestra.ratpdev.com/networks/qbo/exports/medias.zip",
		realtimeResourceHrefs: [
			"https://feed-qub-quimper.ratpdev.com/GTFS-RT_tripUpdate/gtfs-rt.bin",
			"https://feed-qub-quimper.ratpdev.com/GTFS-RT_vehiclePosition/gtfs-rt.bin",
		],
		mode: "NO-TU",
		getNetworkRef: () => "QUB",
		mapVehiclePosition: (vehicle) => {
			vehicle.position.bearing = undefined; // always at 0
			vehicle.vehicle.id = vehicle.vehicle.label;
			return vehicle;
		},
	},
	{
		id: "quimperle",
		staticResourceHref: "https://pysae.com/api/v2/groups/quimperle/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/quimperle/gtfs-rt"],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: () => "TBK",
		mapLineRef: (lineRef) => lineRef.split("-")[0],
		getVehicleRef: (vehicle) => vehicle?.label,
	},
	{
		id: "rennes",
		staticResourceHref: "https://eu.ftp.opendatasoft.com/star/gtfs/GTFS_STAR_BUS_METRO_EN_COURS.zip",
		realtimeResourceHrefs: [
			"https://proxy.transport.data.gouv.fr/resource/star-rennes-integration-gtfs-rt-trip-update",
			"https://proxy.transport.data.gouv.fr/resource/star-rennes-integration-gtfs-rt-vehicle-position",
		],
		excludeScheduled: (trip) => trip.route.type !== "SUBWAY",
		mode: "NO-TU",
		getNetworkRef: () => "STAR",
	},
	{
		id: "saint-brieuc",
		staticResourceHref: "https://www.data.gouv.fr/api/1/datasets/r/9bccfc79-5d35-4fc3-8296-526b791fc950",
		realtimeResourceHrefs: [],
		getNetworkRef: () => "TUB",
	},
	{
		id: "saint-malo",
		staticResourceHref: "https://www.data.gouv.fr/api/1/datasets/r/3bd31fbe-93f4-432d-ade7-ee8d69897880",
		realtimeResourceHrefs: [
			"https://proxy.transport.data.gouv.fr/resource/mat-st-malo-gtfs-rt?token=KZL1tb49w8EZODCIq8b3RpI8DKoUB6iV27Cfw_KBoWY",
		],
		mode: "NO-TU",
		getNetworkRef: () => "MAT",
		getVehicleRef: (vehicle) => vehicle?.label,
	},
	{
		id: "vannes",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/565533c0-64ae-44d6-9dfa-169be5b805c6",
		realtimeResourceHrefs: [
			"https://proxy.transport.data.gouv.fr/resource/kiceo-vannes-gtfs-rt-trip-update",
			"https://proxy.transport.data.gouv.fr/resource/kiceo-vannes-gtfs-rt-vehicle-position",
		],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		mode: "NO-TU",
		excludeScheduled: true,
		getNetworkRef: () => "KICEO",
		getVehicleRef: (vehicle) => vehicle?.label ?? undefined,
		isValidJourney: (journey) =>
			(typeof journey.line !== "undefined" &&
				["CREACEO", "MATINEO", "MOBICEO"].some((ref) => journey.line?.ref.endsWith(ref))) ||
			typeof journey.destination !== "undefined" ||
			journey.calls?.some((call) => call.callStatus === "UNSCHEDULED"),
	},
	{
		id: "vitre",
		staticResourceHref: "https://www.data.gouv.fr/api/1/datasets/r/282974b2-bf13-41f2-a0bf-feb0682e594e",
		realtimeResourceHrefs: [
			"https://gtfs.bus-tracker.fr/gtfs-rt/vitre/trip-updates",
			"https://gtfs.bus-tracker.fr/gtfs-rt/vitre/vehicle-positions",
		],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		mode: "NO-TU",
		getNetworkRef: () => "VITRE",
		getVehicleRef: (vehicle) => vehicle?.id,
		getDestination: (journey, vehicle) => vehicle?.label ?? journey?.trip.headsign,
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
