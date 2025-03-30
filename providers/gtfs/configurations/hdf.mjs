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
		id: "beauvais",
		staticResourceHref:
			"https://api.oisemob.cityway.fr/dataflow/offre-tc/download?provider=COROLIS_URB&dataFormat=GTFS&dataProfil=OPENDATA",
		realtimeResourceHrefs: [
			"https://api.oisemob.cityway.fr/dataflow/vehicule-tc-tr/download?provider=COROLIS_URB&dataFormat=gtfs-rt",
			"https://api.oisemob.cityway.fr/dataflow/horaire-tc-tr/download?provider=COROLIS_URB&dataFormat=gtfs-rt",
		],
		mode: "NO-TU",
		getNetworkRef: () => "COROLIS",
		getVehicleRef: (vehicle) => vehicle?.id.slice(3),
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
		id: "compiegne",
		staticResourceHref:
			"https://api.oisemob.cityway.fr/dataflow/offre-tc/download?provider=TIC_URB&dataFormat=GTFS&dataProfil=OPENDATA",
		realtimeResourceHrefs: [
			"https://api.oisemob.cityway.fr/dataflow/vehicule-tc-tr/download?provider=TIC_URB&dataFormat=gtfs-rt",
			"https://api.oisemob.cityway.fr/dataflow/horaire-tc-tr/download?provider=TIC_URB&dataFormat=gtfs-rt",
		],
		mode: "NO-TU",
		getNetworkRef: () => "TIC",
		getVehicleRef: (vehicle) => vehicle?.id.slice(3),
	},
	{
		id: "creil",
		staticResourceHref:
			"https://api.oisemob.cityway.fr/dataflow/offre-tc/download?provider=AXO&dataFormat=GTFS&dataProfil=OPENDATA",
		realtimeResourceHrefs: [
			"https://api.oisemob.cityway.fr/dataflow/horaire-tc-tr/download?provider=AXO&dataFormat=gtfs-rt",
			"https://api.oisemob.cityway.fr/dataflow/vehicule-tc-tr/download?provider=AXO&dataFormat=gtfs-rt",
		],
		mode: "NO-TU",
		getNetworkRef: () => "AXO",
		getVehicleRef: (vehicle) => vehicle?.id.slice(3),
	},
	{
		id: "lens-bethune",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/d4efef07-b80d-4922-af53-1599f5b5628a",
		realtimeResourceHrefs: [],
		getNetworkRef: () => "TADAO",
	},
	{
		id: "oise-trio1",
		staticResourceHref: "https://api.oisemob.cityway.fr/dataflow/offre-tc/download?provider=TRIO1&dataFormat=GTFS",
		realtimeResourceHrefs: [
			"https://api.oisemob.cityway.fr/dataflow/vehicule-tc-tr/download?provider=TRIO1&dataFormat=GTFS-RT",
			"https://api.oisemob.cityway.fr/dataflow/horaire-tc-tr/download?provider=TRIO1&dataFormat=GTFS-RT",
		],
		mode: "NO-TU",
		getNetworkRef: () => "OISE",
		getVehicleRef: (vehicle) => vehicle?.id.slice(3),
	},
	{
		id: "oise-ko2",
		staticResourceHref: "https://api.oisemob.cityway.fr/dataflow/offre-tc/download?provider=KO2&dataFormat=GTFS",
		realtimeResourceHrefs: [
			"https://api.oisemob.cityway.fr/dataflow/vehicule-tc-tr/download?provider=KO2&dataFormat=GTFS-RT",
			"https://api.oisemob.cityway.fr/dataflow/horaire-tc-tr/download?provider=KO2&dataFormat=GTFS-RT",
		],
		mode: "NO-TU",
		getNetworkRef: () => "OISE",
		getVehicleRef: (vehicle) => vehicle?.id.slice(3),
	},
	{
		id: "oise-trio3",
		staticResourceHref: "https://api.oisemob.cityway.fr/dataflow/offre-tc/download?provider=TRIO3&dataFormat=GTFS",
		realtimeResourceHrefs: [
			"https://api.oisemob.cityway.fr/dataflow/vehicule-tc-tr/download?provider=TRIO3&dataFormat=GTFS-RT",
			"https://api.oisemob.cityway.fr/dataflow/horaire-tc-tr/download?provider=TRIO3&dataFormat=GTFS-RT",
		],
		mode: "NO-TU",
		getNetworkRef: () => "OISE",
		getVehicleRef: (vehicle) => vehicle?.id.slice(3),
	},
	{
		id: "oise-rio4",
		staticResourceHref: "https://api.oisemob.cityway.fr/dataflow/offre-tc/download?provider=RIO4&dataFormat=GTFS",
		realtimeResourceHrefs: [
			"https://api.oisemob.cityway.fr/dataflow/vehicule-tc-tr/download?provider=RIO4&dataFormat=GTFS-RT",
			"https://api.oisemob.cityway.fr/dataflow/horaire-tc-tr/download?provider=RIO4&dataFormat=GTFS-RT",
		],
		mode: "NO-TU",
		getNetworkRef: () => "OISE",
		getVehicleRef: (vehicle) => vehicle?.id.slice(3),
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
