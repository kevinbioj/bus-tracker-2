/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "troyes",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/764e07f3-4297-44ac-810e-f3db295dbef6",
		realtimeResourceHrefs: [
			"https://transport.data.gouv.fr/resources/81544/download",
			"https://transport.data.gouv.fr/resources/81543/download",
		],
		excludeScheduled: true,
		getNetworkRef: () => "TCAT",
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
