/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "tcl",
		staticResourceHref: "https://gtfs.bus-tracker.fr/tcl.zip",
		realtimeResourceHrefs: ["https://gtfs.bus-tracker.fr/gtfs-rt/tcl/"],
		gtfsOptions: {
			filterTrips: (trip) => trip.route.id !== "T36",
		},
		mode: "NO-TU",
		appendTripUpdateInformation: true,
		getNetworkRef: () => "TCL",
		getOperatorRef: (_, vehicle) => {
			if (vehicle?.id) {
				const [operatorRef] = vehicle.id.split(":");
				if (operatorRef) {
					return operatorRef;
				}
			}
		},
		getVehicleRef: (vehicle) => {
			const number = vehicle?.id.split(":")[1];
			if (number?.startsWith("UNKNOWN_")) return undefined;
			return number;
		},
	},
];

/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
	id: "lyon",
	computeDelayMs: 10_000,
	sources,
};

export default configuration;
