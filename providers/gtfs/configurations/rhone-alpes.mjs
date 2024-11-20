/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "grenoble",
		staticResourceHref: "https://data.mobilites-m.fr/api/gtfs/SEM",
		realtimeResourceHrefs: [],
		getNetworkRef: () => "TAG",
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
