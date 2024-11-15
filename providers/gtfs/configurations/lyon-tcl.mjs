/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "lyon",
		staticResourceHref:
			"https://gtech-transit-prod.apigee.net/v1/google/gtfs/odbl/lyon_tcl.zip?apikey=BasyG6OFZXgXnzWdQLTwJFGcGmeOs204&secret=gNo6F5PhQpsGRBCK",
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
