/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "flixbus",
		staticResourceHref: "https://gtfs.gis.flix.tech/gtfs_generic_eu.zip",
		realtimeResourceHrefs: ["https://rt.flix.baguette.pirnet.si/rt.pb"],
		excludeScheduled: true,
		mode: 'NO-TU',
		gtfsOptions: { ignoreBlocks: true },
		getNetworkRef: () => "FLIXBUS",
		getDestination: (journey) => journey?.calls.findLast((call) => call.status !== "SKIPPED")?.stop.name,
		getVehicleRef: () => undefined,
		isValidJourney: (vehicleJourney) => vehicleJourney.line !== undefined,
	},
];

/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
	id: "macron-bus",
	computeDelayMs: 15_000,
	sources,
};

export default configuration;
