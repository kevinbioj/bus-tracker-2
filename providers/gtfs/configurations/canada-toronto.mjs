/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "toronto",
		staticResourceHref:
			"https://ckan0.cf.opendata.inter.prod-toronto.ca/dataset/bd4809dd-e289-4de8-bbde-c5c00dafbf4f/resource/28514055-d011-4ed7-8bb0-97961dfe2b66/download/SurfaceGTFS.zip",
		realtimeResourceHrefs: [
			"https://gtfsrt.ttc.ca/trips/update?format=binary",
			"https://gtfsrt.ttc.ca/vehicles/position?format=binary",
		],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: () => "TORONTO",
	},
];

/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
	computeDelayMs: 30_000,
	sources,
};

export default configuration;
