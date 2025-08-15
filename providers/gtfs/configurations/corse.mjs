/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "interurbain-sud",
		staticResourceHref: "https://www.data.gouv.fr/api/1/datasets/r/fe20cb23-34b8-4965-acf7-1b28bf966891",
		realtimeResourceHrefs: [
			"https://ctc.plateforme-2cloud.com/api/gtfsrt/2.0/tripupdates/CTC-2298-2048-0876/bin",
			"https://ctc.plateforme-2cloud.com/api/gtfsrt/2.0/vehiclepositions/CTC-2298-2048-0876/bin",
		],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: () => "VIA-STRADA",
		getVehicleRef: (vehicle) => vehicle?.label,
	},
	{
		id: "porto-vecchio",
		staticResourceHref: "https://pysae.com/api/v2/groups/porto-vecchio/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/porto-vecchio/gtfs-rt"],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		mode: "NO-TU",
		excludeScheduled: true,
		getNetworkRef: () => "A-CITADINA",
		getVehicleRef: (vehicle) => vehicle?.label,
	},
];

/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
	computeDelayMs: 15_000,
	redisOptions: {
		url: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
		username: process.env.REDIS_USERNAME,
		password: process.env.REDIS_PASSWORD,
	},
	sources,
};

export default configuration;
