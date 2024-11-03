/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "brest",
		staticResourceHref:
			"https://s3.eu-west-1.amazonaws.com/files.orchestra.ratpdev.com/networks/bibus/exports/medias.zip",
		realtimeResourceHrefs: [
			"https://proxy.transport.data.gouv.fr/resource/bibus-brest-gtfs-rt-vehicle-position",
			"https://proxy.transport.data.gouv.fr/resource/bibus-brest-gtfs-rt-trip-update",
		],
		excludeScheduled: true,
		getNetworkRef: () => "BIBUS",
		getVehicleRef: () => undefined,
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
