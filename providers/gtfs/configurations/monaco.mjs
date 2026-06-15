/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "monaco",
		staticResourceHref: "https://www.data.gouv.fr/api/1/datasets/r/2f510784-2957-48e3-b01c-b0e4f9938da7",
		realtimeResourceHrefs: [
			"https://kong.apps.data.caas.mc-tech.net/data-platform-api/data/stream-file/s3-data-factory-mc-dropbox-aws/transport_flux/CAM/BUS/GTFS_RT/VehiclePositions.pb",
			"https://kong.apps.data.caas.mc-tech.net/data-platform-api/data/stream-file/s3-data-factory-mc-dropbox-aws/transport_flux/CAM/BUS/GTFS_RT/TripUpdates.pb",
		],
		excludeScheduled: true,
		mode: "NO-TU",
		mapVehiclePosition: (vehicle) => {
			vehicle.vehicle.id = vehicle.vehicle.label;
			return vehicle;
		},
		getNetworkRef: () => "MONACO",
		mapLineRef: (lineRef) => lineRef.split("-")[1],
		mapStopRef: (stopRef) => stopRef.split("-")[1],
	},
];

/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
	id: "monaco",
	computeDelayMs: 30_000,
	sources,
};

export default configuration;
