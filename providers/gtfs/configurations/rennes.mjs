/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "rennes",
		staticResourceHref: "https://eu.ftp.opendatasoft.com/star/gtfs/GTFS_1_20241029_20241210_20241029153431.zip",
		realtimeResourceHrefs: [
			"https://proxy.transport.data.gouv.fr/resource/star-rennes-integration-gtfs-rt-trip-update",
			"https://proxy.transport.data.gouv.fr/resource/star-rennes-integration-gtfs-rt-vehicle-position",
		],
		mode: "NO-TU",
		excludeScheduled: true,
		getNetworkRef: () => "STAR",
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
