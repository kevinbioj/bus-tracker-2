/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "nantes",
		staticResourceHref:
			"https://data.nantesmetropole.fr/explore/dataset/244400404_tan-arrets-horaires-circuits/files/16a1a0af5946619af621baa4ad9ee662/download/",
		realtimeResourceHrefs: [],
		getNetworkRef: () => "NAOLIB",
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
