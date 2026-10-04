/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "renfe",
		staticResourceHref: "https://gtfs.bus-tracker.fr/renfe.zip",
		realtimeResourceHrefs: [
			"https://gtfsrt.renfe.com/trip_updates_LD.pb",
			"https://gtfsrt.renfe.com/vehicle_positions_LD.pb",
			"https://gtfsrt.renfe.com/alerts.pb",
		],
		mode: "NO-TU",
		hasRealVehicles: false,
		stopArrivals: true,
		getAheadTime: () => 10 * 60,
		getNetworkRef: (journey) => (journey?.trip.route.name === "AVE INT" ? "RENFE-FR" : "RENFE-ES"),
		getDestination: (journey) => journey?.calls.findLast((call) => call.status !== "SKIPPED")?.stop.name,
		getVehicleRef: (_, journey) => journey?.trip.shortName,
	},
];

/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
	id: "renfe",
	computeDelayMs: 15_000,
	sources,
};

export default configuration;
