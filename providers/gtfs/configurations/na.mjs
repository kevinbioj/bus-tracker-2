import { Temporal } from "temporal-polyfill";

/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "agen",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/c1415ff3-7457-4b51-aead-aacbf03a474e",
		realtimeResourceHrefs: ["https://zenbus.net/gtfs/rt/poll.proto?src=true&dataset=agen-urbain"],
		mode: "NO-TU",
		mapVehiclePosition: (vehicle) =>
			Temporal.Now.instant().since(Temporal.Instant.fromEpochMilliseconds(vehicle.timestamp * 1000)).total("minutes") < 60
				? vehicle
				: undefined,
		getNetworkRef: () => "TEMPOBUS",
		getVehicleRef: () => undefined,
	},
	{
		id: "agen-scolaire",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/3fd582f2-e2ef-4ad7-894c-6f057b53b006",
		realtimeResourceHrefs: ["https://zenbus.net/gtfs/rt/poll.proto?src=true&dataset=agen-scolaire"],
		mode: "NO-TU",
		mapVehiclePosition: (vehicle) =>
			Temporal.Now.instant().since(Temporal.Instant.fromEpochMilliseconds(vehicle.timestamp * 1000)).total("minutes") < 60
				? vehicle
				: undefined,
		getNetworkRef: () => "TEMPOBUS",
		getVehicleRef: () => undefined,
	},
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
		id: "na-79",
		staticResourceHref: "https://pysae.com/api/v2/groups/deux-sevres/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/deux-sevres/gtfs-rt"],
		mode: "NO-TU",
		mapLineRef: (lineRef) => `79-${lineRef}`,
		getAheadTime: () => 5 * 60,
		getNetworkRef: () => "REGION-NA",
		getVehicleRef: (vehicle) => vehicle?.label ?? undefined,
		getDestination: (journey) => journey?.calls.findLast((call) => call.status !== "SKIPPED")?.stop.name,
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
