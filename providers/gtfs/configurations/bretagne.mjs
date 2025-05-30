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
		id: "breizhgo-22",
		staticResourceHref: "https://www.korrigo.bzh/ftp/OPENDATA/BREIZHGO_CAR_22.gtfs.zip",
		realtimeResourceHrefs: ["https://www.korrigo.bzh/ftp/OPENDATA/gtfsrt/TIBUS.GtfsRt.pb"],
		getNetworkRef: () => "BREIZHGO",
		mapLineRef: (lineRef) => `BZH22-${lineRef}`,
	},
	{
		id: "breizhgo-29",
		staticResourceHref: "https://www.transdev-bretagne.com/bzh/open-data/breizhgo-29/gtfs",
		realtimeResourceHrefs: [
			"https://cat29.geo3d.hanoverdisplays.com/api-1.0/gtfs-rt/trip-updates",
			"https://cat29.geo3d.hanoverdisplays.com/api-1.0/gtfs-rt/vehicle-positions",
		],
		getNetworkRef: () => "BREIZHGO",
		mapLineRef: (lineRef) => `BZH29-${lineRef}`,
	},
	{
		id: "breizhgo-35",
		staticResourceHref: "https://www.korrigo.bzh/ftp/OPENDATA/BREIZHGO_CAR_35.gtfs.zip",
		realtimeResourceHrefs: ["https://www.korrigo.bzh/ftp/OPENDATA/gtfsrt/BREIZHGO_CAR_35.GtfsRt.pb"],
		getNetworkRef: () => "BREIZHGO",
		mapLineRef: (lineRef) => `BZH35-${lineRef}`,
	},
	{
		id: "breizhgo-56",
		staticResourceHref: "https://www.korrigo.bzh/ftp/OPENDATA/BREIZHGO_CAR_56.gtfs.zip",
		realtimeResourceHrefs: [
			"https://proxy.transport.data.gouv.fr/resource/kiceo-vannes-gtfs-rt-trip-update",
			"https://proxy.transport.data.gouv.fr/resource/kiceo-vannes-gtfs-rt-vehicle-position",
		],
		getNetworkRef: () => "BREIZHGO",
		isValidJourney: (journey) =>
			typeof journey.destination !== "undefined" || journey.calls?.some((call) => call.callStatus === "UNSCHEDULED"),
		mapLineRef: (lineRef) => `BZH56-${lineRef}`,
	},
	{
		id: "breizhgo-ns",
		staticResourceHref: "https://www.transdev-bretagne.com/bzh/open-data/breizhgo-lrr-ns/gtfs",
		realtimeResourceHrefs: [
			"https://proxy.transport.data.gouv.fr/resource/kiceo-vannes-gtfs-rt-trip-update",
			"https://proxy.transport.data.gouv.fr/resource/kiceo-vannes-gtfs-rt-vehicle-position",
		],
		getNetworkRef: () => "BREIZHGO",
		mapLineRef: (lineRef) => `BZHNS-${lineRef}`,
		mapTripUpdate: (tripUpdate) => {
			delete tripUpdate.trip.tripId;
			if (tripUpdate.trip.routeId === "LRR.143") {
				tripUpdate.trip.routeId = "143";
			}
			return tripUpdate;
		},
		mapVehiclePosition: (vehicle) => {
			delete vehicle.trip?.tripId;
			if (vehicle.trip?.routeId === "LRR.143") {
				vehicle.trip.routeId = "143";
			}
			return vehicle;
		},
		isValidJourney: (journey) => journey.line?.ref.endsWith("BZHNS-143"),
	},
	{
		id: "breizhgo-rp",
		staticResourceHref: "https://pysae.com/api/v2/groups/breizhgo-lrr/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/breizhgo-lrr/gtfs-rt"],
		getNetworkRef: () => "BREIZHGO",
		getVehicleRef: (vehicle) => vehicle?.label ?? undefined,
		mapLineRef: (lineRef) => `BZHRP-${lineRef}`,
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
		id: "lorient",
		staticResourceHref:
			"https://s3.eu-west-1.amazonaws.com/files.orchestra.ratpdev.com/networks/rdla-lorient/exports/medias.zip",
		realtimeResourceHrefs: ["https://feed-rdla-lorient.ratpdev.com/GTFS-RT"],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		getNetworkRef: () => "IZILO",
		getVehicleRef: (vehicle) => vehicle?.label ?? undefined,
	},
	{
		id: "quimper",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/0cf733af-e58a-4b56-ab18-abbd09de7d02",
		realtimeResourceHrefs: [],
		gtfsOptions: {
			// QUB City comes in the next source
			filterTrips: (trip) => trip.route.id !== "QCIT-648",
		},
		getNetworkRef: () => "QUB",
	},
	{
		id: "quimper-navette",
		staticResourceHref: "https://zenbus.net/gtfs/static/download.zip?dataset=quimper",
		realtimeResourceHrefs: ["https://zenbus.net/gtfs/rt/poll.proto?dataset=quimper"],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: () => "QUB",
		getVehicleRef: () => undefined,
		mapLineRef: (lineRef) => lineRef.slice(nthIndexOf(lineRef, ":", 2) + 1, nthIndexOf(lineRef, ":", 3)),
		mapStopRef: (stopRef) => stopRef.slice(nthIndexOf(stopRef, ":", 3) + 1, nthIndexOf(stopRef, ":", 4)),
	},
	{
		id: "rennes",
		staticResourceHref: "https://gtfs.bus-tracker.fr/star.zip",
		realtimeResourceHrefs: [
			"https://proxy.transport.data.gouv.fr/resource/star-rennes-integration-gtfs-rt-trip-update",
			"https://proxy.transport.data.gouv.fr/resource/star-rennes-integration-gtfs-rt-vehicle-position",
		],
		excludeScheduled: (trip) => trip.route.type !== "SUBWAY",
		mode: "NO-TU",
		getNetworkRef: () => "STAR",
	},
	{
		id: "saint-malo",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/3bd31fbe-93f4-432d-ade7-ee8d69897880",
		realtimeResourceHrefs: ["https://proxy.transport.data.gouv.fr/resource/mat-saint-malo-gtfs-rt-trip-update"],
		getNetworkRef: () => "MAT",
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
