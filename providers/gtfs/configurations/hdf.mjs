/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "amiens",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/5bc8b7dc-0d4e-48e7-b2ec-eccfe3702c19",
		realtimeResourceHrefs: [
			"https://proxy.transport.data.gouv.fr/resource/ametis-amiens-gtfs-rt-vehicle-position",
			"https://proxy.transport.data.gouv.fr/resource/ametis-amiens-gtfs-rt-trip-update",
		],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		excludeScheduled: true,
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
		gtfsOptions: { shapesStrategy: "IGNORE" },
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: () => "COROLIS",
		getVehicleRef: (vehicle) => vehicle?.id.slice(3),
	},
	{
		id: "boulogne",
		staticResourceHref:
			"https://s3.eu-west-1.amazonaws.com/files.orchestra.ratpdev.com/networks/boulogne/exports/medias.zip",
		realtimeResourceHrefs: [
			"https://proxy.transport.data.gouv.fr/resource/marineo-boulonnais-gtfs-rt-trip-update?token=KZL1tb49w8EZODCIq8b3RpI8DKoUB6iV27Cfw_KBoWY",
		],
		getNetworkRef: () => "MARINEO",
		getVehicleRef: (vehicle) => vehicle?.label,
	},
	{
		id: "calais",
		staticResourceHref: "https://zenbus.net/gtfs/static/download.zip?dataset=sitac-calais-rt",
		realtimeResourceHrefs: ["https://zenbus.net/gtfs/rt/poll.proto?dataset=sitac-calais-rt"],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		excludeScheduled: true,
		mode: "VP-ONLY",
		getNetworkRef: () => "SITAC",
		getVehicleRef: () => undefined,
	},
	{
		id: "coeur-flandres",
		staticResourceHref: "https://gtfs-rt.infra-hubup.fr/hopbus/current/revision/gtfs",
		realtimeResourceHrefs: ["https://gtfs-rt.infra-hubup.fr/hopbus/realtime"],
		gtfsOptions: {
			filterTrips: (trip) => {
				if (["216", "217", "218"].includes(trip.route.id)) return false;
				if (trip.direction === 2) trip.direction = 1;
				return true;
			},
			importAllStops: true,
		},
		mode: "NO-TU",
		getNetworkRef: () => "HOP-BUS",
		getVehicleRef: (vehicle) => vehicle?.label,
	},
	{
		id: "compiegne",
		staticResourceHref:
			"https://api.oisemob.cityway.fr/dataflow/offre-tc/download?provider=TIC_URB&dataFormat=GTFS&dataProfil=OPENDATA",
		realtimeResourceHrefs: [
			"https://api.oisemob.cityway.fr/dataflow/vehicule-tc-tr/download?provider=TIC_URB&dataFormat=gtfs-rt",
			"https://api.oisemob.cityway.fr/dataflow/horaire-tc-tr/download?provider=TIC_URB&dataFormat=gtfs-rt",
		],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		excludeScheduled: true,
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
		gtfsOptions: { shapesStrategy: "IGNORE" },
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: () => "AXO",
		getVehicleRef: (vehicle) => vehicle?.id.slice(3),
	},
	{
		id: "douai",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/99cf5e2f-87c2-4ff1-bc0d-32f04cc213ab",
		realtimeResourceHrefs: [],
		getNetworkRef: () => "EVEOLE",
	},
	{
		id: "lens-bethune",
		staticResourceHref: "https://www.data.gouv.fr/fr/datasets/r/99f29f9e-0dee-473d-9f9c-188e9d1ce9e5",
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
		gtfsOptions: { shapesStrategy: "IGNORE" },
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: () => "OISE",
		getOperatorRef: () => "TRIO1",
		getVehicleRef: (vehicle) => vehicle?.id.slice(3),
	},
	{
		id: "oise-ko2",
		staticResourceHref: "https://api.oisemob.cityway.fr/dataflow/offre-tc/download?provider=KO2&dataFormat=GTFS",
		realtimeResourceHrefs: [
			"https://api.oisemob.cityway.fr/dataflow/vehicule-tc-tr/download?provider=KO2&dataFormat=GTFS-RT",
			"https://api.oisemob.cityway.fr/dataflow/horaire-tc-tr/download?provider=KO2&dataFormat=GTFS-RT",
		],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: () => "OISE",
		getOperatorRef: () => "KO2",
		getVehicleRef: (vehicle) => vehicle?.id.slice(3),
	},
	{
		id: "oise-trio3",
		staticResourceHref: "https://api.oisemob.cityway.fr/dataflow/offre-tc/download?provider=TRIO3&dataFormat=GTFS",
		realtimeResourceHrefs: [
			"https://api.oisemob.cityway.fr/dataflow/vehicule-tc-tr/download?provider=TRIO3&dataFormat=GTFS-RT",
			"https://api.oisemob.cityway.fr/dataflow/horaire-tc-tr/download?provider=TRIO3&dataFormat=GTFS-RT",
		],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: () => "OISE",
		getOperatorRef: () => "TRIO3",
		getVehicleRef: (vehicle) => vehicle?.id.slice(3),
	},
	{
		id: "oise-rio4",
		staticResourceHref: "https://api.oisemob.cityway.fr/dataflow/offre-tc/download?provider=RIO4&dataFormat=GTFS",
		realtimeResourceHrefs: [
			"https://api.oisemob.cityway.fr/dataflow/vehicule-tc-tr/download?provider=RIO4&dataFormat=GTFS-RT",
			"https://api.oisemob.cityway.fr/dataflow/horaire-tc-tr/download?provider=RIO4&dataFormat=GTFS-RT",
		],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: () => "OISE",
		getOperatorRef: () => "RIO4",
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
