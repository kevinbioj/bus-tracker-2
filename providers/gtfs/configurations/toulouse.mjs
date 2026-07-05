// Options partagées par les deux sources : elles s'appuient sur le même GTFS
// statique Tisséo, mais consomment des feeds temps réel d'origines différentes.
/** @type {import('../src/model/source.ts').SourceOptions} */
const commonOptions = {
	staticResourceHref:
		"https://data.toulouse-metropole.fr/explore/dataset/tisseo-gtfs/files/fc1dda89077cf37e4f7521760e0ef4e9/download/",
	appendTripUpdateInformation: true,
	gtfsOptions: {
		postLoad: (resource) => {
			resource.stops.set("code:00189", {
				id: "code:00189",
				name: "Arènes",
				latitude: 43.593745975607014,
				longitude: 1.4179662944363263,
			});

			resource.stops.set("code:06766", {
				id: "code:06766",
				name: "Saint Cyprien - République",
				latitude: 43.5981022,
				longitude: 1.4315255,
			});

			resource.stops.set("code:05781", {
				id: "code:05781",
				name: "Pader",
				latitude: 43.6359222,
				longitude: 1.4331975,
			});

			resource.stops.set("code:06981", resource.stops.get("stop_point:SP_212"));
			resource.stops.set("code:02763", resource.stops.get("stop_point:SP_3541"));
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
		excludeScheduled: true,
	},
];

/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
	id: "toulouse",
	computeDelayMs: 20_000,
	sources,
};

export default configuration;
