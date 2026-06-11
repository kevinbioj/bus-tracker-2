/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "interurbain-sud",
		staticResourceHref: "https://www.data.gouv.fr/api/1/datasets/r/fe20cb23-34b8-4965-acf7-1b28bf966891",
		realtimeResourceHrefs: [
			"https://ctc.plateforme-2cloud.com/api/gtfsrt/2.0/tripupdates/CTC-2298-2048-0876/bin",
			"https://ctc.plateforme-2cloud.com/api/gtfsrt/2.0/vehiclepositions/CTC-2298-2048-0876/bin",
		],
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: () => "VIA-STRADA",
		getVehicleRef: (vehicle) => vehicle?.label,
	},
	{
		id: "porto-vecchio",
		staticResourceHref: "https://pysae.com/api/v2/groups/porto-vecchio/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/porto-vecchio/gtfs-rt"],
		mode: "NO-TU",
		excludeScheduled: true,
		getNetworkRef: () => "A-CITADINA",
		getVehicleRef: (vehicle) => vehicle?.label,
	},
];

/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
	id: "corse",
	computeDelayMs: 30_000,
	sources,
};

export default configuration;
