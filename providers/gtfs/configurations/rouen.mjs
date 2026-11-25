// const tcarSchedulableLineIds = ["06", "45", "46", "47", "48", "49", "50", "60", "89"];
// biome-ignore format: keep it one-liner is good
const tniOperatedLineIds = ['06', '13', '14', '27', '28', '33', '35', '36', '37', '38', '42', '44', '45', '46', '47', '48', '49', '50', '51', '60', '89'];
const isTniVehicle = (id) => (id >= 421 && id <= 435) || (id >= 670 && id <= 685) || (id >= 734 && id <= 736);

const stripAgencyPrefix = (id) => id.replace(/^(TCAR|TAE|TNI):/, "");

/**
 * Course non honorée : aucun véhicule ne lui est attitré, et elle est partie depuis au moins
 * 5 minutes. Observé à Rouen, où le flux renvoie parfois du temps réel sur des courses que
 * plus aucun bus n'assure : passé ce délai, ce temps réel est jugé fantaisiste, et le passage
 * affiché comme « potentiellement supprimé ».
 */
const UNHONORED_DEPARTED_SINCE_MS = 5 * 60 * 1000;
/** Âge maximal d'une position GPS reçue pour retenir un véhicule comme attitré à la course. */
const ASSIGNED_VEHICLE_MAX_POSITION_AGE_MS = 5 * 60 * 1000;

// biome-ignore format: keep it one-liner is good
const POTENTIALLY_CANCELLABLE_ROUTES = [
	"90", "91", "92", "93", "94", "95", "01", "02", "03", "04", "05", "07", "08", "10", "11", "15", "20", "22", "41", "43", "98",
];

const isPotentiallyCanceled = ({ journey, nowMs }) => {
	// Seules certaines lignes sont éligibles à cette "auto-détection"
	if (!POTENTIALLY_CANCELLABLE_ROUTES.includes(stripAgencyPrefix(journey?.trip.route.id))) return false;

	// Un véhicule est attitré à la course (descripteur temps réel, ou position GPS récente) :
	// elle est honorée.
	if (journey.vehicleDescriptor !== undefined) return false;
	if (
		journey.lastVehiclePositionAtMs !== undefined &&
		nowMs - journey.lastVehiclePositionAtMs <= ASSIGNED_VEHICLE_MAX_POSITION_AGE_MS
	)
		return false;

	// Partie depuis au moins 5 minutes sans véhicule : la course n'est vraisemblablement pas
	// honorée. Jugé sur le départ temps réel, à défaut théorique.
	return nowMs - journey.originDepartureMs >= UNHONORED_DEPARTED_SINCE_MS;
};

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
		isPotentiallyCanceled,
	},
];

/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
	id: "rouen",
	computeDelayMs: 5_000,
	sources,
};

export default configuration;
