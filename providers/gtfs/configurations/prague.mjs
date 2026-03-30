const isTramwayRoute = (routeId) => {
	if (["L58", "L59"].includes(routeId)) return false;

	const routeIdAsNumber = +routeId.slice(1);
	return routeIdAsNumber >= 1 && routeIdAsNumber <= 99;
};

/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "prague",
		staticResourceHref: "https://data.pid.cz/PID_GTFS.zip",
		realtimeResourceHrefs: ["https://api.golemio.cz/v2/vehiclepositions/gtfsrt/pid_feed.pb"],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: () => "PID",
		getVehicleRef: (vehicle) => vehicle?.label,
		mapVehiclePosition: (vehicle) => {
			if (isTramwayRoute(vehicle.trip.routeId)) {
				vehicle.vehicle.label = `tram-${vehicle.vehicle.label}`;
			}

			return vehicle;
		},
	},
];

/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
	computeDelayMs: 60_000,
	sources,
};

export default configuration;
