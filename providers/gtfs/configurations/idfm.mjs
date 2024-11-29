/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "idfm",
		staticResourceHref:
			"https://data.iledefrance-mobilites.fr/explore/dataset/offre-horaires-tc-gtfs-idfm/files/a925e164271e4bca93433756d6a340d1/download/",
		gtfsOptions: { filterTrips: (trip) => trip.route.name !== "TER" && trip.route.type !== "BUS" },
		getNetworkRef: () => "IDFM",
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
