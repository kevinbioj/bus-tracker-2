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
		mode: "NO-TU",
		getNetworkRef: () => "BIBUS",
		// "anonymised" vehicle reference 😅🤣
		getVehicleRef: (vehicle) => (vehicle ? +vehicle.id - 2 ** 28 : undefined),
	},
	{
		id: "rennes",
		staticResourceHref: "https://gtfs.bus-tracker.fr/star.zip",
		realtimeResourceHrefs: [
			"https://proxy.transport.data.gouv.fr/resource/star-rennes-integration-gtfs-rt-trip-update",
			"https://proxy.transport.data.gouv.fr/resource/star-rennes-integration-gtfs-rt-vehicle-position",
		],
		mode: "NO-TU",
		excludeScheduled: (trip) => trip.route.type !== "SUBWAY",
		getNetworkRef: () => "STAR",
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
