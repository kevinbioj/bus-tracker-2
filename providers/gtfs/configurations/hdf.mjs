/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "amiens",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/5bc8b7dc-0d4e-48e7-b2ec-eccfe3702c19",
		realtimeResourceHrefs: [
			"https://proxy.transport.data.gouv.fr/resource/ametis-amiens-gtfs-rt-vehicle-position",
			"https://proxy.transport.data.gouv.fr/resource/ametis-amiens-gtfs-rt-trip-update",
		],
		mode: "VP-ONLY",
		getNetworkRef: () => "AMETIS",
	},
	{
		id: "arras",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/e3ff01b4-bac9-40b6-83a3-4b91ce0045b5",
		realtimeResourceHrefs: [],
		getNetworkRef: () => "ARTIS",
	},
	{
		id: "calais",
		staticResourceHref: "https://zenbus.net/gtfs/static/download.zip?dataset=sitac-calais-rt",
		realtimeResourceHrefs: ["https://zenbus.net/gtfs/rt/poll.proto?dataset=sitac-calais-rt"],
		excludeScheduled: true,
		mode: "VP-ONLY",
		getNetworkRef: () => "SITAC",
		getVehicleRef: () => undefined,
	},
	{
		id: "lens-bethune",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/7b2754e2-006f-49e5-b8f1-0d784a62fb98",
		realtimeResourceHrefs: [],
		getNetworkRef: () => "TADAO",
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
