/** @type {import('../src/model/source.ts').Source[]} */
const sources = [
	{
		id: "dijon",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/e0dbd217-15cd-4e28-9459-211a27511a34",
		realtimeResourceHrefs: [
			"https://proxy.transport.data.gouv.fr/resource/divia-dijon-gtfs-rt-trip-update",
			"https://proxy.transport.data.gouv.fr/resource/divia-dijon-gtfs-rt-vehicle-position",
		],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		allowScheduled: (trip) =>
			[
				"4-PL",
				"4-39",
				"4-61",
				"4-62",
				"4-63",
				"4-64",
				"4-65",
				"4-66",
				"4-67",
				"4-68",
				"4-69",
				"4-70",
				"4-71",
				"4-72",
				"4-73",
				"4-74",
				"4-75",
			].includes(trip.route),
		getNetworkRef: () => "DIVIA",
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
