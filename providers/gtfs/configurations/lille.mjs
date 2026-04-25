/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "lille",
		staticResourceHref: "https://media.ilevia.fr/opendata/gtfs.zip",
		realtimeResourceHrefs: ["https://proxy.transport.data.gouv.fr/resource/ilevia-lille-gtfs-rt"],
		excludeScheduled: true,
		getNetworkRef: () => "ILLEVIA",
	},
];

/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
	id: "lille",
	computeDelayMs: 60_000,
	sources,
};

export default configuration;
