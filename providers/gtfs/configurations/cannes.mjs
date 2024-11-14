/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "cannes",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/47bc8088-6c72-43ad-a959-a5bbdd1aa14f",
		realtimeResourceHrefs: [
			"https://proxy.transport.data.gouv.fr/resource/palmbus-cannes-gtfs-rt-vehicle-position",
			"https://proxy.transport.data.gouv.fr/resource/palmbus-cannes-gtfs-rt-trip-update",
		],
		excludeScheduled: true,
		getNetworkRef: () => "PALMBUS",
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
