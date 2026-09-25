/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "montpellier",
		staticResourceHref: "https://gtfsproxy.e-tam.fr/COMMON/GTFS.zip",
		realtimeResourceHrefs: [
			{ href: "https://gtfsproxy.e-tam.fr/COMMON/TripUpdate.pb", pollMs: 30_000 },
			"https://gtfsproxy.e-tam.fr/COMMON/VehiclePosition.pb",
		],
		mode: "NO-TU",
		getNetworkRef: () => "TAM",
		mapLineRef: (lineRef) => lineRef.replace(/^S_/, ""),
	},
];

/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
	id: "montpellier",
	computeDelayMs: 10_000,
	sources,
};

export default configuration;
