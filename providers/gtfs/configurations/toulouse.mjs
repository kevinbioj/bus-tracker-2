/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "toulouse",
		staticResourceHref:
			"https://data.toulouse-metropole.fr/explore/dataset/tisseo-gtfs/files/fc1dda89077cf37e4f7521760e0ef4e9/download/",
		realtimeResourceHrefs: ["https://gtfs.bus-tracker.fr/gtfs-rt/tisseo"],
		appendTripUpdateInformation: true,
		addedTripShapeMatching: true,
		gtfsOptions: {
			postLoad: (resource) => {
				resource.stops.set("code:06766", {
					id: "code:06766",
					name: "Saint Cyprien - République",
					latitude: 43.5981022,
					longitude: 1.4315255,
				});
			},
		},
		excludeScheduled: (trip) =>
			[
				"TELEO",
				"25",
				"26",
				"30",
				"31",
				"31p",
				"32",
				"33",
				"35",
				"40",
				"41",
				"42",
				"43",
				"46",
				"49",
				"50",
				"51",
				"53",
				"55",
				"69",
				"71",
				"74",
				"75",
				"80",
				"82",
				"101",
				"102",
				"103",
				"104",
				"107",
				"109",
				"110",
				"111",
				"112",
				"113",
				"114",
				"115",
				"116",
				"117",
				"121",
				"126",
				"130",
				"131",
				"132",
				"150",
				"151",
				"152",
				"169",
				"201",
				"202",
				"204",
				"205",
				"301",
				"302",
				"303",
				"304",
				"305",
				"306",
				"310",
				"311",
				"312",
				"313",
				"314",
				"315",
				"316",
				"317",
				"318",
				"320",
				"321",
				"401",
				"402",
				"403",
				"NVACC",
			].includes(trip.route.name),
		mapLineRef: (lineRef) => `GTFS:${lineRef.slice(lineRef.indexOf(":") + 1)}`,
		mapStopRef: (stopRef) => stopRef.slice(stopRef.indexOf(":") + 1),
		getNetworkRef: () => "TISSEO",
		getVehicleRef: (vehicle, journey) => {
			if (journey?.trip.route.id === "line:204") {
				return vehicle?.id.split(":")[0];
			}

			return vehicle?.id;
		},
		isValidJourney: (journey) =>
			journey.id.includes("VehicleTracking") || journey.calls?.every((call) => call.expectedTime === undefined),
	},
];

/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
	id: "toulouse",
	computeDelayMs: 10_000,
	sources,
};

export default configuration;
