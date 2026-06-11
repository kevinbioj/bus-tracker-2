/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "montpellier",
		staticResourceHref: "https://data.montpellier3m.fr/GTFS/Urbain/GTFS.zip",
		realtimeResourceHrefs: [
			"https://data.montpellier3m.fr/GTFS/Urbain/VehiclePosition.pb",
			"https://data.montpellier3m.fr/GTFS/Urbain/TripUpdate.pb",
		],
		mode: "NO-TU",
		getNetworkRef: () => "TAM",
	},
	{
		id: "montpellier-sub",
		staticResourceHref: "https://data.montpellier3m.fr/GTFS/Suburbain/GTFS.zip",
		realtimeResourceHrefs: [
			"https://data.montpellier3m.fr/GTFS/Suburbain/VehiclePosition.pb",
			"https://data.montpellier3m.fr/GTFS/Suburbain/TripUpdate.pb",
		],
		mode: "NO-TU",
		getNetworkRef: () => "TAM",
	},
];

/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
	id: "montpellier",
	computeDelayMs: 30_000,
	sources,
};

export default configuration;
