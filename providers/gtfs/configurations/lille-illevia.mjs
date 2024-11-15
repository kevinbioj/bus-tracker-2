/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "lille",
		staticResourceHref: "https://media.ilevia.fr/opendata/gtfs.zip",
		realtimeResourceHrefs: ["https://proxy.transport.data.gouv.fr/resource/ilevia-lille-gtfs-rt"],
		// excludeScheduled: true,
		getNetworkRef: () => "ILLEVIA",
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
