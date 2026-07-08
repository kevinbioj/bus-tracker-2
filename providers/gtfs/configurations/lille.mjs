/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "lille",
		staticResourceHref: "https://gtfs.bus-tracker.fr/ilevia.zip",
		realtimeResourceHrefs: ["https://proxy.transport.data.gouv.fr/resource/ilevia-lille-gtfs-rt"],
		appendTripUpdateInformation: true,
		excludeScheduled: (trip) => /\d{2}R/.test(trip.route.id),
		getNetworkRef: () => "ILLEVIA",
	},
];

/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
	id: "lille",
	computeDelayMs: 15_000,
	sources,
};

export default configuration;
