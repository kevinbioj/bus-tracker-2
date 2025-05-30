/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "lemans",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/5339d96c-6d20-4a01-939a-40f7b56d6cc1",
		realtimeResourceHrefs: [
			"https://proxy.transport.data.gouv.fr/resource/setram-lemans-gtfs-rt-trip-update",
			"https://proxy.transport.data.gouv.fr/resource/setram-lemans-gtfs-rt-vehicle-position",
		],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: () => "SETRAM",
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
