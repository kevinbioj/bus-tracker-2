/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "na-33",
		staticResourceHref:
			"https://www.pigma.org/public/opendata/nouvelle_aquitaine_mobilites/publication/gironde-aggregated-gtfs.zip",
		realtimeResourceHrefs: ["https://citram.geo3d.hanoverdisplays.com/api-1.0/gtfs-rt/vehicle-positions"],
		gtfsOptions: {
			shapesStrategy: "IGNORE",
		},
		getNetworkRef: () => "REGION-NA",
	},
	{
		id: "poitiers",
		staticResourceHref:
			"https://data.grandpoitiers.fr/data-fair/api/v1/datasets/2gwvlq16siyb7d9m3rqt1pb1/metadata-attachments/gtfs.zip",
		realtimeResourceHrefs: [
			"https://data.grandpoitiers.fr/data-fair/api/v1/datasets/2gwvlq16siyb7d9m3rqt1pb1/metadata-attachments/poitiers.pbf",
		],
		getNetworkRef: () => "VITALIS",
	},
];

/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
	computeDelayMs: 60_000,
	redisOptions: {
		url: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
		username: process.env.REDIS_USERNAME,
		password: process.env.REDIS_PASSWORD,
	},
	sources,
};

export default configuration;
