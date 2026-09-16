/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "caen",
		staticResourceHref:
			"https://data.twisto.fr/api/v2/catalog/datasets/fichier-gtfs-du-reseau-twisto/alternative_exports/gtfs_twisto_zip",
		realtimeResourceHrefs: ["https://gtfs.bus-tracker.fr/gtfs-rt/caen/"],
		gtfsOptions: {
			computeShapeDistTraveled: "always",
			postLoad: (resource) => {
				for (const trip of resource.trips.values()) {
					trip.store.flagsBitmask[0] |= 2;
					trip.store.flagsBitmask[trip.store.flagsBitmask.length - 1] |= 1;
				}
			},
		},
		excludeScheduled: (trip) => {
			const lineAsNumber = parseInt(trip.route.name, 10);
			return Number.isNaN(lineAsNumber) || lineAsNumber < 100;
		},
		mode: "NO-TU",
		getNetworkRef: () => "TWISTO",
		getVehicleRef: (vehicle) => vehicle?.id,
	},
];

/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
	id: "caen",
	computeDelayMs: 10_000,
	sources,
};

export default configuration;
