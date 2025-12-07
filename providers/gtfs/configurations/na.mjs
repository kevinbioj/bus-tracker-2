import { Temporal } from "temporal-polyfill";

function nthIndexOf(input, pattern, n) {
	const length = input.length;
	let i = -1;
	let j = n;
	while (j-- && i++ < length) {
		i = input.indexOf(pattern, i);
		if (i < 0) break;
	}
	return i;
}

const d30bdxZenbusVehiclesMap = new Map([
	["zenbus:Vehicle:4805196849872896:LOC", "196030"],
	["zenbus:Vehicle:4874152314929152:LOC", "256001"],
	["zenbus:Vehicle:4810821377982464:LOC", "256002"],
]);

/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "30direct-bordeaux",
		staticResourceHref: "https://zenbus.net/gtfs/static/download.zip?dataset=bordeaux-navettes-aeroport",
		realtimeResourceHrefs: ["https://zenbus.net/gtfs/rt/poll.proto?dataset=bordeaux-navettes-aeroport"],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		excludeScheduled: true,
		mode: "NO-TU",
		mapVehiclePosition: (vehicle) =>
			Temporal.Now.instant()
				.since(Temporal.Instant.fromEpochMilliseconds(vehicle.timestamp * 1000))
				.total("minutes") < 60
				? vehicle
				: undefined,
		mapLineRef: (lineRef) => lineRef.slice(nthIndexOf(lineRef, ":", 2) + 1, nthIndexOf(lineRef, ":", 3)),
		mapStopRef: (stopRef) => stopRef.slice(nthIndexOf(stopRef, ":", 3) + 1, nthIndexOf(stopRef, ":", 4)),
		getNetworkRef: () => "30D-BORDEAUX",
		getDestination: (journey) => journey?.calls.findLast((call) => call.status !== "SKIPPED")?.stop.name,
		getVehicleRef: (vehicle) => (vehicle?.id ? d30bdxZenbusVehiclesMap.get(vehicle.id) : undefined),
	},
	{
		id: "agen",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/c1415ff3-7457-4b51-aead-aacbf03a474e",
		realtimeResourceHrefs: ["https://zenbus.net/gtfs/rt/poll.proto?src=true&dataset=agen-urbain"],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		excludeScheduled: true,
		mode: "NO-TU",
		mapVehiclePosition: (vehicle) =>
			Temporal.Now.instant()
				.since(Temporal.Instant.fromEpochMilliseconds(vehicle.timestamp * 1000))
				.total("minutes") < 60
				? vehicle
				: undefined,
		getNetworkRef: () => "TEMPOBUS",
		getVehicleRef: () => undefined,
	},
	{
		id: "agen-scolaire",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/3fd582f2-e2ef-4ad7-894c-6f057b53b006",
		realtimeResourceHrefs: ["https://zenbus.net/gtfs/rt/poll.proto?src=true&dataset=agen-scolaire"],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		excludeScheduled: true,
		mode: "NO-TU",
		mapVehiclePosition: (vehicle) =>
			Temporal.Now.instant()
				.since(Temporal.Instant.fromEpochMilliseconds(vehicle.timestamp * 1000))
				.total("minutes") < 60
				? vehicle
				: undefined,
		getNetworkRef: () => "TEMPOBUS",
		getVehicleRef: () => undefined,
	},
	{
		id: "basque-adour",
		staticResourceHref:
			"https://app.mecatran.com/utw/ws/gtfsfeed/static/txiktxak?apiKey=0f64273f070b7d4621002040646e180d374e5373",
		realtimeResourceHrefs: [
			"https://app.mecatran.com/utw/ws/gtfsfeed/realtime/txiktxak?apiKey=0f64273f070b7d4621002040646e180d374e5373",
		],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		excludeScheduled: true,
		getNetworkRef: () => "TXIKTXAK",
		getVehicleRef: () => undefined,
		getAheadTime: () => 120,
	},
	{
		id: "la-rochelle",
		staticResourceHref:
			"https://www.pigma.org/public/opendata/nouvelle_aquitaine_mobilites/publication/ca_la_rochelle-aggregated-gtfs.zip",
		realtimeResourceHrefs: ["https://gtfs.bus-tracker.fr/gtfs-rt/yelo/"],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: () => "YELO",
		getVehicleRef: (vehicle) => vehicle?.id,
		getDestination: (journey, vehicle) =>
			vehicle?.label ?? journey?.calls.findLast((call) => call.status !== "SKIPPED")?.stop.name,
		mapLineRef: (lineRef) => lineRef.slice(nthIndexOf(lineRef, ":", 2) + 1),
		mapStopRef: (stopRef) => stopRef.slice(nthIndexOf(stopRef, ":", 3) + 1),
	},
	{
		id: "na-79",
		staticResourceHref: "https://pysae.com/api/v2/groups/deux-sevres/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/deux-sevres/gtfs-rt"],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		excludeScheduled: true,
		mode: "NO-TU",
		getAheadTime: () => 5 * 60,
		getNetworkRef: () => "NA-79",
		getVehicleRef: (vehicle) => vehicle?.label ?? undefined,
		getDestination: (journey) => journey?.calls.findLast((call) => call.status !== "SKIPPED")?.stop.name,
	},
	{
		id: "niort",
		staticResourceHref:
			"https://www.pigma.org/public/opendata/nouvelle_aquitaine_mobilites/publication/ca_du_niortais-aggregated-gtfs.zip",
		realtimeResourceHrefs: [
			"https://gtfs.bus-tracker.fr/gtfs-rt/niort/trip-updates",
			"https://gtfs.bus-tracker.fr/gtfs-rt/niort/vehicle-positions",
		],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: () => "NIORT",
		getVehicleRef: (vehicle) => vehicle?.id,
		getDestination: (journey, vehicle) => vehicle?.label ?? journey?.trip.headsign,
		mapLineRef: (lineRef) => lineRef.split(":")[2],
	},
	{
		id: "niort-int",
		staticResourceHref: "https://pysae.com/api/v2/groups/tanlib/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/tanlib/gtfs-rt"],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: () => "NIORT",
		getVehicleRef: (vehicle) => vehicle?.label,
		mapLineRef: (lineRef) => `INT-${lineRef}`,
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
	{
		id: "respire",
		staticResourceHref: "https://zenbus.net/gtfs/static/download.zip?dataset=iledere75923021",
		realtimeResourceHrefs: ["https://zenbus.net/gtfs/rt/poll.proto?dataset=iledere75923021"],
		mode: "NO-TU",
		getNetworkRef: () => "RESPIRE",
		getVehicleRef: () => undefined,
		getDestination: (journey) => journey?.calls.findLast((call) => call.status !== "SKIPPED")?.stop.name,
		mapLineRef: (lineRef) => lineRef.slice(nthIndexOf(lineRef, ":", 2) + 1, nthIndexOf(lineRef, ":", 3)),
		mapStopRef: (stopRef) => stopRef.slice(nthIndexOf(stopRef, ":", 3) + 1, nthIndexOf(stopRef, ":", 4)),
	},
	{
		id: "saintes",
		staticResourceHref: "https://zenbus.net/gtfs/static/download.zip?dataset=buss-cdasaintes",
		realtimeResourceHrefs: ["https://zenbus.net/gtfs/rt/poll.proto?dataset=buss-cdasaintes"],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: () => "SAINTES",
		getVehicleRef: () => undefined,
		mapLineRef: (lineRef) => lineRef.slice(nthIndexOf(lineRef, ":", 2) + 1, nthIndexOf(lineRef, ":", 3)),
		mapStopRef: (stopRef) => stopRef.slice(nthIndexOf(stopRef, ":", 3) + 1, nthIndexOf(stopRef, ":", 4)),
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
