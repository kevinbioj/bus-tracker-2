import { Temporal } from "temporal-polyfill";

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
			if (trip.route.id === "TCAR:43") {
				return !["Place Colbert MONT-SAINT-AIGNAN", "Place du Vivier HOUPPEVILLE"].includes(trip.headsign);
			}

			if (/^TCAR:2\d\d$/.test(trip.route.id)) return false;
			return !tniOperatedLineIds.flatMap((id) => [id, `TCAR:${id}`]).includes(trip.route.id);
		},
		getNetworkRef: () => "ASTUCE",
		getOperatorRef: (journey, vehicle) => {
			if (
				typeof journey !== "undefined" &&
				tniOperatedLineIds.flatMap((id) => [id, `TCAR:${id}`]).includes(journey.trip.route.id)
			) {
				return "TNI";
			}

			if (typeof vehicle !== "undefined" && isTniVehicle(+vehicle.id)) {
				return "TNI";
			}

			return "TCAR";
		},
		getVehicleRef: (vehicle) => vehicle?.id,
		getDestination: (journey, vehicle) => vehicle?.label ?? journey?.calls.at(-1)?.stop.name ?? "SPECIAL",
		isValidJourney: (vehicleJourney) => {
			// Étant donné que les données sont parfois partielles, on prend le premier arrêt avec du temps réel
			// et on propage son avance-retard à l'envers... étant donné que c'est calculé de façon bête et
			// méchante ça passe plutôt bien.
			if (vehicleJourney.calls?.length && !vehicleJourney.calls.at(0).expectedTime) {
				const firstMonitoredCallIndex = vehicleJourney.calls.findIndex((call) => call.expectedTime);
				if (firstMonitoredCallIndex >= 0) {
					const firstMonitoredCall = vehicleJourney.calls.at(firstMonitoredCallIndex);
					const delay = Temporal.Instant.from(firstMonitoredCall.expectedTime)
						.since(firstMonitoredCall.aimedTime)
						.total("seconds");
					for (let i = firstMonitoredCallIndex - 1; i >= 0; i -= 1) {
						const call = vehicleJourney.calls.at(i);
						call.expectedTime = Temporal.Instant.from(call.aimedTime)
							.add({ seconds: delay })
							.toZonedDateTimeISO("Europe/Paris")
							.toString({ timeZoneName: "never" });
					}
				}
			}

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
			// vehicle.timestamp += 3600;
			return vehicle;
		},
	},
	{
		id: "tae",
		staticResourceHref: "https://gtfs.bus-tracker.fr/astuce-tae.zip",
		realtimeResourceHrefs: ["https://gtfs.tae76.fr/gtfs-rt.bin"],
		mapTripUpdate: (tripUpdate) => {
			if (!tripUpdate.vehicle?.id) return;
			if (tripUpdate.stopTimeUpdate?.some(({ arrival }) => arrival?.delay > 5400)) return;
			return tripUpdate;
		},
		getDestination: (journey) =>
			journey?.trip.stopTimes
				.at(-1)
				.stop.name.toUpperCase()
				.normalize("NFD")
				.replace(/\p{Diacritic}/gu, ""),
		getAheadTime: (journey) =>
			journey?.calls.some((c) => !!(c.expectedArrivalTime ?? c.expectedDepartureTime)) ? 15 * 60 : 0,
		getNetworkRef: () => "ASTUCE",
		getOperatorRef: () => "TAE",
	},
	// {
	// 	id: "tgr",
	// 	staticResourceHref: "https://gtfs.bus-tracker.fr/astuce-tgr.zip",
	// 	realtimeResourceHrefs: ["https://pysae.com/api/v2/groups/tcar/gtfs-rt"],
	// 	mode: "NO-TU",
	// 	excludeScheduled: (trip) => trip.route.name === "06",
	// 	getNetworkRef: () => "ASTUCE",
	// 	getOperatorRef: () => "TNI",
	// 	getVehicleRef: (descriptor) => descriptor?.label ?? undefined,
	// },
	{
		id: "tni",
		staticResourceHref: "https://gtfs.bus-tracker.fr/astuce-tni.zip",
		realtimeResourceHrefs: [
			"https://mrn.geo3d.hanoverdisplays.com/api-1.0/gtfs-rt/trip-updates",
			"https://mrn.geo3d.hanoverdisplays.com/api-1.0/gtfs-rt/vehicle-positions",
		],
		mode: "NO-TU",
		getNetworkRef: (journey) => {
			if (
				typeof journey !== "undefined" &&
				journey.trip.route.name === "530" &&
				[journey.calls.at(0), journey.calls.at(-1)].some((call) => call.stop.name === "Caudebec - Quai")
			) {
				return "NOMAD-CAR";
			}
			return "ASTUCE";
		},
		getDestination: (journey) => `${journey.calls.at(0)?.stop.name} > ${journey.calls.at(-1)?.stop.name}`,
		getOperatorRef: () => "TNI",
	},
	// {
	// 	id: "hanga",
	// 	staticResourceHref: "https://exs.tcar.cityway.fr/gtfs.aspx?key=OPENDATA&operatorCode=ASTUCE&companyCode=ASTUCE:004",
	// 	realtimeResourceHrefs: [],
	// 	getNetworkRef: () => "ASTUCE",
	// 	getOperatorRef: (journey) => (["204", "214"].includes(journey?.trip.route.id) ? "TNI" : "HANGA"),
	// 	getDestination: (journey) => journey?.trip.stopTimes.at(-1).stop.name,
	// },
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
