/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "tcl",
		staticResourceHref: "https://gtfs.bus-tracker.fr/tcl.zip",
		realtimeResourceHrefs: ["https://gtfs.bus-tracker.fr/gtfs-rt/tcl"],
		gtfsOptions: { shapesStrategy: true },
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: () => "TCL",
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
