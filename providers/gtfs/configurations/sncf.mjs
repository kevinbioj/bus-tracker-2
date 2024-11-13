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
		id: "sncf-ter",
		staticResourceHref: "https://eu.ftp.opendatasoft.com/sncf/gtfs/export-ter-gtfs-last.zip",
		realtimeResourceHrefs: ["https://proxy.transport.data.gouv.fr/resource/sncf-ter-gtfs-rt-trip-updates"],
		excludeScheduled: true,
		getNetworkRef: () => "SNCF",
		getVehicleRef: (_, journey) => journey?.trip.headsign,
		getDestination: (journey) => journey?.calls.findLast((call) => call.status !== "SKIPPED")?.stop.name,
		mapLineRef: (lineRef) => lineRef.slice(nthIndexOf(lineRef, ":", 3) + 1, lineRef.lastIndexOf(":")),
		mapStopRef: (stopRef) => stopRef.slice(stopRef.indexOf(":") + 1),
		mapTripRef: (tripRef) => tripRef.slice(0, tripRef.indexOf(":")),
	},
	{
		id: "sncf-intercites",
		staticResourceHref: "https://eu.ftp.opendatasoft.com/sncf/gtfs/export-intercites-gtfs-last.zip",
		realtimeResourceHrefs: ["https://proxy.transport.data.gouv.fr/resource/sncf-ic-gtfs-rt-trip-updates"],
		excludeScheduled: true,
		getNetworkRef: () => "SNCF",
		getVehicleRef: (_, journey) => journey?.trip.headsign,
		getDestination: (journey) => journey?.calls.findLast((call) => call.status !== "SKIPPED")?.stop.name,
		mapLineRef: (lineRef) => lineRef.slice(nthIndexOf(lineRef, ":", 3) + 1, lineRef.lastIndexOf(":")),
		mapStopRef: (stopRef) => stopRef.slice(stopRef.indexOf(":") + 1),
		mapTripRef: (tripRef) => tripRef.slice(0, tripRef.indexOf(":")),
	},
	{
		id: "sncf-tgv",
		staticResourceHref: "https://eu.ftp.opendatasoft.com/sncf/gtfs/export_gtfs_voyages.zip",
		realtimeResourceHrefs: ["https://proxy.transport.data.gouv.fr/resource/sncf-tgv-gtfs-rt-trip-updates"],
		excludeScheduled: true,
		getNetworkRef: () => "SNCF",
		getVehicleRef: (_, journey) => journey?.trip.headsign,
		getDestination: (journey) => journey?.calls.findLast((call) => call.status !== "SKIPPED")?.stop.name,
		mapLineRef: (lineRef) => lineRef.slice(nthIndexOf(lineRef, ":", 3) + 1, lineRef.lastIndexOf(":")),
		mapStopRef: (stopRef) => stopRef.slice(stopRef.indexOf(":") + 1),
		mapTripRef: (tripRef) => tripRef.slice(0, tripRef.indexOf(":")),
	},
];

/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
	computeDelayMs: 10_000,
	redisOptions: {
		url: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
		username: process.env.REDIS_USERNAME,
		password: process.env.REDIS_PASSWORD,
	},
	sources,
};

export default configuration;
