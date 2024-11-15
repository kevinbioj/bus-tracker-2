/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "dijon",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/e0dbd217-15cd-4e28-9459-211a27511a34",
		realtimeResourceHrefs: [
			"https://proxy.transport.data.gouv.fr/resource/divia-dijon-gtfs-rt-trip-update",
			"https://proxy.transport.data.gouv.fr/resource/divia-dijon-gtfs-rt-vehicle-position",
		],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		excludeScheduled: (trip) =>
			![
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
	{
		id: "metz",
		staticResourceHref: "https://data.lemet.fr/documents/LEMET-gtfs.zip",
		realtimeResourceHrefs: [
			"https://proxy.transport.data.gouv.fr/resource/lemet-metz-gtfs-rt-trip-update",
			"https://proxy.transport.data.gouv.fr/resource/lemet-metz-gtfs-rt-vehicle-position",
		],
		excludeScheduled: true,
		getNetworkRef: () => "LEMET",
	},
	{
		id: "reims",
		staticResourceHref:
			"https://www.datagrandest.fr/metadata/fluo-grand-est/FR-200052264-T0031-0000/fluo-grand-est-rei-gtfs.zip",
		realtimeResourceHrefs: ["https://proxy.transport.data.gouv.fr/resource/fluo-citura-reims-gtfs-rt"],
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: () => "GRM",
	},
	{
		id: "troyes",
		// TODO: À remplacer lorsqu'ils auront corrigé le problème de line endings
		staticResourceHref: "https://gtfs.bus-tracker.fr/troyes.zip",
		realtimeResourceHrefs: [
			"https://transport.data.gouv.fr/resources/81544/download",
			"https://transport.data.gouv.fr/resources/81543/download",
		],
		mode: "NO-TU",
		excludeScheduled: true,
		getNetworkRef: () => "TCAT",
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
