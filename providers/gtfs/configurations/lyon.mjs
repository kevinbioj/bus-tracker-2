/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "tcl",
		staticResourceHref: "https://gtfs.bus-tracker.fr/tcl.zip",
		realtimeResourceHrefs: ["https://gtfs.bus-tracker.fr/gtfs-rt/tcl/"],
		excludeScheduled: (trip) => {
			if (["130", "139", "212", "213", "T36"].includes(trip.route.name)) return true;
			if (trip.route.name.startsWith("JD")) return true;
			return false;
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
		getVehicleRef: (vehicle) => vehicle?.id.split(":")[1],
	},
	{
		id: "transports-faure-28bi",
		staticResourceHref: "https://pysae.com/api/v2/groups/transports-faure-28bi/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/transports-faure-28bi/gtfs-rt"],
		excludeScheduled: true,
		mode: "NO-TU",
		mapLineRef: (lineRef) => `28BI-${lineRef}`,
		getNetworkRef: () => "TCL",
		getOperatorRef: () => "CARS_FAURE",
		getVehicleRef: (vehicle) => vehicle?.label ?? undefined,
	},
	{
		id: "cars-faure-tcl",
		staticResourceHref: "https://pysae.com/api/v2/groups/cars-faure-tcl/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/cars-faure-tcl/gtfs-rt"],
		excludeScheduled: true,
		mode: "NO-TU",
		mapLineRef: (lineRef) => `FAUR-${lineRef}`,
		getNetworkRef: () => "TCL",
		getOperatorRef: () => "CARS_FAURE",
		getVehicleRef: (vehicle) => vehicle?.label ?? undefined,
	},
];

/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
	id: "lyon",
	computeDelayMs: 20_000,
	sources,
};

export default configuration;
