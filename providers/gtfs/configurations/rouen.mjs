// const tcarSchedulableLineIds = ["06", "45", "46", "47", "48", "49", "50", "60", "89"];
// biome-ignore format: keep it one-liner is good
const tniOperatedLineIds = ['06', '13', '14', '27', '28', '33', '35', '36', '37', '38', '42', '44', '45', '46', '47', '48', '49', '50', '60', '89'];
const isTniVehicle = (id) => (id >= 421 && id <= 435) || (id >= 670 && id <= 685) || (id >= 734 && id <= 736);

/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "tcar",
		staticResourceHref: "https://gtfs.bus-tracker.fr/astuce-global.zip",
		realtimeResourceHrefs: [
			"https://gtfs.bus-tracker.fr/gtfs-rt/tcar/trip-updates",
			"https://gtfs.bus-tracker.fr/gtfs-rt/tcar/vehicle-positions",
		],
		mode: "NO-TU",
		gtfsOptions: {
			filterTrips: (trip) => {
				if (trip.route.id === "TCAR:99") trip.block = "CALYPSO";
				return trip.route.id.startsWith("TCAR");
			},
		},
		getAheadTime: (journey) => (journey?.trip.route.id === "TCAR:99" ? 5 * 60 : undefined),
		excludeScheduled: (trip) => {
			if (/^TCAR:2\d\d$/.test(trip.route.id)) return false;
			return !tniOperatedLineIds.flatMap((id) => [id, `TCAR:${id}`]).includes(trip.route.id);
		},
		getNetworkRef: () => "ASTUCE",
		getOperatorRef: (journey, vehicle) => {
			if (
				journey !== undefined &&
				tniOperatedLineIds.flatMap((id) => [id, `TCAR:${id}`]).includes(journey.trip.route.id)
			) {
				return "TNI";
			}

			if (vehicle !== undefined && isTniVehicle(+vehicle.id)) {
				return "TNI";
			}

			return "TCAR";
		},
		getVehicleRef: (vehicle) => vehicle?.id,
		getDestination: (journey, vehicle) =>
			vehicle?.label ?? journey?.calls?.findLast((call) => call.status !== "SKIPPED")?.stop.name,
		isValidJourney: (vehicleJourney) => {
			// Les premiers shifts métro sont graphiqués à tort sur le jour N-1
			if (vehicleJourney.line?.ref === "ASTUCE:Line:90") {
				const aimedTime = vehicleJourney.calls?.[0]?.aimedTime
					? Temporal.Instant.from(vehicleJourney.calls[0].aimedTime).toZonedDateTimeISO("Europe/Paris")
					: undefined;

				// courses >= 00:00 + < 04:00 non affectées
				if (aimedTime !== undefined && aimedTime.hour >= 4) {
					vehicleJourney.serviceDate = aimedTime.toPlainDate();
				}
			}

			return true;
		},
		mapLineRef: (lineRef) => lineRef.replace("TCAR:", ""),
		mapVehiclePosition: (vehicle) => {
			vehicle.vehicle.id = vehicle.vehicle.id.replace("TCAR:", "");
			return vehicle;
		},
	},
	{
		id: "tae",
		staticResourceHref: "https://gtfs.bus-tracker.fr/astuce-tae.zip",
		realtimeResourceHrefs: [
			"https://api.mrn.cityway.fr/dataflow/horaire-tc-tr/download?provider=TAE&dataFormat=GTFS-RT",
			"https://api.mrn.cityway.fr/dataflow/vehicule-tc-tr/download?provider=TAE&dataFormat=GTFS-RT",
		],
		getAheadTime: () => 15,
		getNetworkRef: () => "ASTUCE",
		getOperatorRef: () => "TAE",
		mapLineRef: (lineRef) => lineRef.replace("TAE:", ""),
	},
	{
		id: "tni",
		staticResourceHref: "https://gtfs.bus-tracker.fr/astuce-tni.zip",
		realtimeResourceHrefs: [
			"https://mrn.geo3d.hanoverdisplays.com/api-1.0/gtfs-rt/trip-updates",
			"https://mrn.geo3d.hanoverdisplays.com/api-1.0/gtfs-rt/vehicle-positions",
		],
		mode: "NO-TU",
		mapTripUpdate: (tripUpdate) => {
			tripUpdate.stopTimeUpdate?.forEach((stopTimeUpdate) => {
				if (typeof stopTimeUpdate.stopId === "string") {
					stopTimeUpdate.stopId = `TNI:${stopTimeUpdate.stopId}`;
				}
			});

			if (typeof tripUpdate.trip.routeId === "string") {
				tripUpdate.trip.routeId = `TNI:${tripUpdate.trip.routeId}`;
			}

			tripUpdate.trip.tripId = `TNI:${tripUpdate.trip.tripId}`;
			return tripUpdate;
		},
		mapVehiclePosition: (vehicle) => {
			if (typeof vehicle.stopId === "string") {
				vehicle.stopId = `TNI:${vehicle.stopId}`;
			}

			if (vehicle.trip !== undefined) {
				vehicle.trip.tripId = `TNI:${vehicle.trip.tripId}`;
				if (vehicle.trip.routeId !== undefined) {
					vehicle.trip.routeId = `TNI:${vehicle.trip.routeId}`;
				}
			}

			return vehicle;
		},
		getNetworkRef: () => "ASTUCE",
		getOperatorRef: () => "TNI",
		mapLineRef: (lineRef) => lineRef.replace("TNI:", ""),
	},
];

/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
	id: "rouen",
	computeDelayMs: 10_000,
	sources,
};

export default configuration;
