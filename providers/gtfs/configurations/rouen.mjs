// const tcarSchedulableLineIds = ["06", "45", "46", "47", "48", "49", "50", "60", "89"];
// biome-ignore format: keep it one-liner is good
const tniOperatedLineIds = ['06', '13', '14', '27', '28', '33', '35', '36', '37', '38', '42', '44', '45', '46', '47', '48', '49', '50', '51', '60', '89'];
const isTniVehicle = (id) => (id >= 421 && id <= 435) || (id >= 670 && id <= 685) || (id >= 734 && id <= 736);

const stripAgencyPrefix = (id) => id.replace(/^(TCAR|TAE|TNI):/, "");

/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
	{
		id: "astuce",
		staticResourceHref: "https://gtfs.bus-tracker.fr/astuce-global.zip",
		realtimeResourceHrefs: ["https://gtfs.bus-tracker.fr/gtfs-rt/tcar/?tae=1&tni=1"],
		mode: "NO-TU",
		passedCallDetection: "VEHICLE",
		gtfsOptions: {
			filterTrips: (trip) => {
				if (trip.route.id === "TCAR:99") trip.block = "CALYPSO";
				return true;
			},
		},
		getAheadTime: (journey) => {
			if (journey?.trip.route.id === "TCAR:99") return 5 * 60;
			return 60;
		},
		getNetworkRef: () => "ASTUCE",
		getOperatorRef: (journey, vehicle) => {
			const agencyId = journey?.trip.route.agency.id ?? vehicle?.id.split(":")[0];
			if (agencyId === "TAE" || agencyId === "TNI") return agencyId;

			if (journey !== undefined && tniOperatedLineIds.includes(stripAgencyPrefix(journey.trip.route.id))) {
				return "TNI";
			}

			if (vehicle !== undefined && isTniVehicle(+stripAgencyPrefix(vehicle.id))) {
				return "TNI";
			}

			return "TCAR";
		},
		getVehicleRef: (vehicle) => (vehicle !== undefined ? stripAgencyPrefix(vehicle.id) : undefined),
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
		mapLineRef: stripAgencyPrefix,
	},
];

/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
	id: "rouen",
	computeDelayMs: 5_000,
	sources,
};

export default configuration;
