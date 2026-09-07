import Papaparse from "papaparse";

// Options partagées par les deux sources : elles s'appuient sur le même GTFS
// statique Tisséo, mais consomment des feeds temps réel d'origines différentes.
/** @type {import('../src/model/source.ts').SourceOptions} */
const commonOptions = {
	staticResourceHref:
		"https://data.toulouse-metropole.fr/explore/dataset/tisseo-gtfs/files/fc1dda89077cf37e4f7521760e0ef4e9/download/",
	appendTripUpdateInformation: true,
	gtfsOptions: {
		postLoad: (resource) => {
			const enrichStops = async () => {
				const response = await fetch("https://gtfs.bus-tracker.fr/tisseo_stops.txt");
				if (!response.ok) {
					return;
				}

				const raw = await response.text();
				const parsed = Papaparse.parse(raw, { header: true, skipEmptyLines: true });

				parsed.data.forEach((row) => {
					resource.stops.set(row.stop_id, {
						id: row.stop_id,
						name: row.stop_name,
						latitude: +row.stop_lat,
						longitude: +row.stop_lon,
					});
				});
			};

			enrichStops();
		},
	},
	mapLineRef: (lineRef) => `GTFS:${lineRef.slice(lineRef.indexOf(":") + 1)}`,
	mapStopRef: (stopRef) => stopRef.slice(stopRef.indexOf(":") + 1),
	getNetworkRef: () => "TISSEO",
	getOperatorRef: (_, vehicle) => {
		if (vehicle?.id === undefined) return;
		const [operatorRef] = vehicle.id.split(":");
		if (["ALCIS", "NEGOTI", "TRANSDEV", "VERDIE"].includes(operatorRef)) {
			return operatorRef;
		}
	},
	mapTripUpdate: (tripUpdate) => {
		if (tripUpdate.trip.routeId === "line:204" && typeof tripUpdate.vehicle?.id === "string") {
			tripUpdate.vehicle.id = tripUpdate.vehicle.id.split(":")[0];
		}

		return tripUpdate;
	},
	getVehicleRef: (vehicle) => vehicle?.label ?? vehicle?.id,
	isValidJourney: (journey) =>
		journey.line?.number === "13" ||
		journey.id.includes("VehicleTracking") ||
		journey.calls?.every((call) => call.expectedTime === undefined),
};

/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	// Jeu officiel Tisséo (api.tisseo.fr) : service complet (trip updates + théorique).
	{
		id: "toulouse",
		...commonOptions,
		realtimeResourceHrefs: ["https://api.tisseo.fr/opendata/gtfsrt/GtfsRt.pb"],
		addedTripShapeMatching: true,
		excludeScheduled: (trip) => !["A", "B"].includes(trip.route.name),
	},
	{
		id: "toulouse-st",
		...commonOptions,
		realtimeResourceHrefs: [
			"https://1.gtfs.download/tisseo/vehicle_positions.pb",
			"https://1.gtfs.download/tisseo/trip_updates.pb",
		],
		mode: "NO-TU",
		excludeScheduled: (trip) =>
			![
				"CIMTR",
				"VILLE",
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
				"109",
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
			].includes(trip.route.name),
	},
];

/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
	id: "toulouse",
	computeDelayMs: 20_000,
	sources,
};

export default configuration;
