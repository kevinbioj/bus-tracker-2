/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "metz",
		staticResourceHref: "https://data.lemet.fr/documents/LEMET-gtfs.zip",
		realtimeResourceHrefs: [
			"https://proxy.transport.data.gouv.fr/resource/lemet-metz-gtfs-rt-trip-update",
			"https://proxy.transport.data.gouv.fr/resource/lemet-metz-gtfs-rt-vehicle-position",
		],
		excludeScheduled: true,
		getNetworkRef: () => "LEMET",
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
