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
		id: "sncf",
		staticResourceHref: "https://gtfs.bus-tracker.fr/sncf.zip",
		realtimeResourceHrefs: [
			"https://proxy.transport.data.gouv.fr/resource/sncf-all-gtfs-rt-trip-updates?token=KZL1tb49w8EZODCIq8b3RpI8DKoUB6iV27Cfw_KBoWY",
		],
		excludeScheduled: true,
		gtfsOptions: {
			mapTripId: (tripId) => tripId.slice(0, tripId.indexOf(":")),
			ignoreBlocks: true,
		},
		getAheadTime: () => 10 * 60,
		mapTripUpdate: (tripUpdate) => {
			tripUpdate.trip.tripId = tripUpdate.trip.tripId.slice(0, tripUpdate.trip.tripId.indexOf(":"));
			return tripUpdate;
		},
		getNetworkRef: () => "SNCF",
		getVehicleRef: (_, journey) => journey?.trip.headsign,
		getDestination: (journey) => journey?.calls.findLast((call) => call.status !== "SKIPPED")?.stop.name,
		mapLineRef: (lineRef) => lineRef.slice(nthIndexOf(lineRef, ":", 3) + 1, lineRef.lastIndexOf(":")),
		mapStopRef: (stopRef) => stopRef.slice(stopRef.indexOf(":") + 1),
	},
	{
		id: "trenitalia",
		staticResourceHref: "https://gtfs.bus-tracker.fr/trenitalia-france.zip",
		realtimeResourceHrefs: [
			"https://proxy.transport.data.gouv.fr/resource/trenitalia-gtfs-rt?token=KZL1tb49w8EZODCIq8b3RpI8DKoUB6iV27Cfw_KBoWY",
		],
		getNetworkRef: () => "TRENITALIA-FR",
		getVehicleRef: () => undefined,
		getDestination: (journey) => journey?.calls.findLast((call) => call.status !== "SKIPPED")?.stop.name,
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
