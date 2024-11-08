/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "reims",
		staticResourceHref:
			"https://www.datagrandest.fr/metadata/fluo-grand-est/FR-200052264-T0031-0000/fluo-grand-est-rei-gtfs.zip",
		realtimeResourceHrefs: ["https://proxy.transport.data.gouv.fr/resource/fluo-citura-reims-gtfs-rt"],
		excludeScheduled: true,
		getNetworkRef: () => "GRM",
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
