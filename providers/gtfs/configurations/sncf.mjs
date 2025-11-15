/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "sncf",
		staticResourceHref: "https://gtfs.bus-tracker.fr/sncf.zip",
		realtimeResourceHrefs: ["https://proxy.transport.data.gouv.fr/resource/sncf-gtfs-rt-trip-updates"],
		excludeScheduled: true,
		gtfsOptions: {
			ignoreBlocks: true,
		},
		getAheadTime: () => 10 * 60,
		getNetworkRef: () => "SNCF",
		getVehicleRef: (_, journey) => journey?.trip.headsign,
		getDestination: (journey) => journey?.calls.findLast((call) => call.status !== "SKIPPED")?.stop.name,
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
