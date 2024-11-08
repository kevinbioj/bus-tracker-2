/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "avigon",
		staticResourceHref: "https://exs.tcra2.cityway.fr/gtfs.aspx?key=UID&operatorCode=TCRA",
		realtimeResourceHrefs: ["https://export.tcra2.cityway.fr/GtfsRt/GtfsRT.TCRA.pb"],
		excludeScheduled: true,
		getNetworkRef: () => "ORIZO",
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
