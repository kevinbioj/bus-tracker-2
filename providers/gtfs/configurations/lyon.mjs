/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "tcl",
		staticResourceHref: "https://gtfs.bus-tracker.fr/tcl.zip",
		realtimeResourceHrefs: ["https://gtfs.bus-tracker.fr/gtfs-rt/tcl/"],
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
		getVehicleRef: (vehicle) => vehicle?.id.split(":")[1],
	},
];

/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
	id: "lyon",
	computeDelayMs: 10_000,
	sources,
};

export default configuration;
