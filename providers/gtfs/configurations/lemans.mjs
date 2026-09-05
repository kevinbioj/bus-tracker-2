/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "lemans",
		staticResourceHref:
			"https://eur.mecatran.com/utw/ws/gtfsfeed/static/lemans?apiKey=73334a124f3a1654141d6979113106450f291d15&type=gtfs_setram_urbsco",
		realtimeResourceHrefs: [
			"https://proxy.transport.data.gouv.fr/resource/setram-lemans-gtfs-rt-trip-update",
			"https://proxy.transport.data.gouv.fr/resource/setram-lemans-gtfs-rt-vehicle-position",
		],
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: () => "SETRAM",
	},
];

/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
	id: "lemans",
	computeDelayMs: 30_000,
	sources,
};

export default configuration;
