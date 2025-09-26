/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "tcl",
		staticResourceHref: "https://gtfs.bus-tracker.fr/tcl.zip",
		realtimeResourceHrefs: ["https://gtfs.bus-tracker.fr/gtfs-rt/tcl"],
		gtfsOptions: { shapesStrategy: "IGNORE" },
		excludeScheduled: true,
		mode: "NO-TU",
		getNetworkRef: () => "TCL",
	},
	{
		id: "transports-faure-28bi",
		staticResourceHref: "https://pysae.com/api/v2/groups/transports-faure-28bi/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/transports-faure-28bi/gtfs-rt"],
		mode: "NO-TU",
		getNetworkRef: () => "TCL",
		getOperatorRef: () => "FAURE-28BI",
		getVehicleRef: (vehicle) => vehicle?.label ?? undefined,
	},
	{
		id: "cars-faure-tcl",
		staticResourceHref: "https://pysae.com/api/v2/groups/cars-faure-tcl/gtfs/pub",
		realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/cars-faure-tcl/gtfs-rt"],
		mode: "NO-TU",
		getNetworkRef: () => "TCL",
		getOperatorRef: () => "FAURE-TCL",
		getVehicleRef: (vehicle) => vehicle?.label ?? undefined,
	},
];

/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
	computeDelayMs: 10_000,
	redisOptions: {
		url: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
		username: process.env.REDIS_USERNAME,
		password: process.env.REDIS_PASSWORD,
	},
	sources,
};

export default configuration;
