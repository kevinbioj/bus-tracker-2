/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "sncf",
		staticResourceHref: "https://gtfs.bus-tracker.fr/sncf.zip",
		realtimeResourceHrefs: ["https://proxy.transport.data.gouv.fr/resource/sncf-gtfs-rt-trip-updates"],
		excludeScheduled: true,
		gtfsOptions: { ignoreBlocks: true },
		getAheadTime: () => 10 * 60,
		getNetworkRef: () => "SNCF",
		getVehicleRef: (_, journey) => journey?.trip.headsign,
		getDestination: (journey) => journey?.calls.findLast((call) => call.status !== "SKIPPED")?.stop.name,
	},
];

/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
	id: "sncf",
	computeDelayMs: 10_000,
	sources,
};

export default configuration;
