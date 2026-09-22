import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { EncodedLinePath, PassedCallDetection, StopDeparture, VehicleJourney } from "@bus-tracker/contracts";
import { downloadGtfs } from "../download/download-gtfs.js";
import type { RealtimeFeedContents } from "../download/download-gtfs-rt.js";
import { type ImportGtfsOptions, importGtfs } from "../import/import-gtfs.js";
import { getStaleness } from "../utils/get-staleness.js";
import { padSourceId } from "../utils/pad-source-id.js";
import { createStopWatch } from "../utils/stop-watch.js";
import type { Gtfs } from "./gtfs.js";
import type { TripModifications, TripUpdate, VehicleDescriptor, VehiclePosition } from "./gtfs-rt.js";
import type { Journey } from "./journey.js";
import { buildEncodedLinePaths } from "./line-path.js";
import type { StopArea } from "./stop-area.js";
import type { Trip } from "./trip.js";

export type SourceAuth =
	| {
			type: "basic";
			username?: string;
			password?: string;
	  }
	| {
			type: "header";
			name: string;
			value: string;
	  };

export type RealtimeResource = {
	href: string;
	/** Intervalle de polling minimal en ms. Si absent, le flux est re-téléchargé à chaque cycle. */
	pollMs?: number;
};

export type SourceOptions = {
	// --- Data provisioning
	staticResourceHref: string;
	realtimeResourceHrefs?: (string | RealtimeResource)[];
	auth?: SourceAuth;
	staticAuth?: SourceAuth;
	realtimeAuth?: SourceAuth;
	gtfsOptions?: ImportGtfsOptions;
	appendTripUpdateInformation?: boolean;
	/**
	 * Durée (ms) pendant laquelle les informations d'un TripUpdate disparu du flux restent
	 * appliquées à la course. Passé ce délai, la course revient à son horaire théorique et ses
	 * arrêts SKIPPED redeviennent desservis. Vaut {@link DEFAULT_TRIP_UPDATE_TTL_MS} par défaut ;
	 * mettre 0 pour abandonner le temps réel dès le premier cycle où la course quitte le flux.
	 */
	tripUpdateTtlMs?: number;
	/**
	 * Âge (ms) au-delà duquel une VehiclePosition est jugée figée et ignorée. Vise les producteurs
	 * qui laissent une course ouverte quand le terminal embarqué se déconnecte (Zenbus notamment) :
	 * la position ne bouge plus tandis que le TripUpdate continue de dériver, et le véhicule
	 * resterait affiché indéfiniment sur sa dernière position connue. Passé ce délai, la course
	 * retombe sur son traitement théorique / TripUpdate, ou disparaît si la source ne le publie pas
	 * (`mode: "VP-ONLY"`, `excludeScheduled`). Absent, aucune position n'est écartée sur ce critère.
	 */
	maxVehiclePositionAgeMs?: number;
	allowTripGuessing?: boolean;
	/**
	 * Apparie une course supplémentaire à un trip théorique de la même ligne pour lui emprunter son
	 * tracé et ses distances curvilignes. Sert de repli aux courses `NEW` dépourvues de
	 * `trip_properties.shape_id`, et conditionne à lui seul la publication des courses `ADDED` —
	 * valeur dépréciée, dont le parcours n'est pas garanti complet.
	 */
	addedTripShapeMatching?: boolean;
	disableRoutePaths?: boolean;
	/**
	 * Manière de juger, sur le tableau des prochains passages d'un arrêt, qu'un véhicule suivi l'a
	 * quitté. `SCHEDULE` (défaut) : dès que son heure de départ est dépassée. `VEHICLE` : seulement
	 * lorsque la séquence ou l'arrêt courant de sa position l'a dépassé — un véhicule en retard sur
	 * un temps réel optimiste reste alors annoncé « imminent » ou « à quai » jusqu'à son passage
	 * effectif. Ne vaut que pour les véhicules suivis en GPS : les autres restent jugés à l'heure.
	 */
	passedCallDetection?: PassedCallDetection;
	// --- Additional data acquirance
	mode?: "ALL" | "VP-ONLY" | "VP+TU" | "NO-TU";
	excludeScheduled?: ((trip: Trip) => boolean) | boolean;
	getAheadTime?: (journey?: Journey) => number;
	getNetworkRef: (journey?: Journey, vehicle?: VehicleDescriptor) => string;
	getOperatorRef?: (journey?: Journey, vehicle?: VehicleDescriptor) => string | undefined;
	getVehicleRef?: (vehicle?: VehicleDescriptor, journey?: Journey) => string | undefined;
	hasRealVehicles?: boolean;
	getDestination?: (journey?: Journey, vehicle?: VehicleDescriptor) => string | undefined;
	getMissionCode?: (journey?: Journey, vehicle?: VehicleDescriptor) => string | null | undefined;
	// --- Data transformation
	mapLineRef?: (lineRef: string) => string;
	mapStopRef?: (stopRef: string) => string;
	mapTripRef?: (tripRef: string) => string;
	mapTripUpdate?: (tripUpdate: TripUpdate, gtfs: Gtfs) => TripUpdate | undefined;
	/**
	 * Retouche une entité `TripModifications` avant son application, ou l'écarte en renvoyant
	 * `undefined`. Pendant du hook {@link SourceOptions.mapTripUpdate} pour les dessertes déviées.
	 */
	mapTripModifications?: (tripModifications: TripModifications, gtfs: Gtfs) => TripModifications | undefined;
	mapVehiclePosition?: (vehicle: VehiclePosition, gtfs: Gtfs) => VehiclePosition | undefined;
	isValidJourney?: (vehicleJourney: VehicleJourney) => boolean;
	/**
	 * Retouche un passage du tableau des prochains passages d'un arrêt, avant qu'il ne soit rendu :
	 * pendant de {@link SourceOptions.isValidJourney} pour les passages, qui ne sont pas des courses
	 * publiées. Sert à y reporter ce qu'une configuration ajoute aux courses hors du GTFS — les voies
	 * SNCF, par exemple, tirées d'un flux SIRI Lite.
	 */
	mapStopDeparture?: (departure: StopDeparture, journey: Journey) => StopDeparture;
	/**
	 * Décide si un passage figure au tableau des prochains passages d'un arrêt : `false` l'écarte. Il
	 * reçoit le passage tel que {@link SourceOptions.mapStopDeparture} l'a retouché. Appliqué avant la
	 * limite du nombre de passages, pour que le tableau reste plein ; le serveur ne réintroduit pas
	 * la course écartée depuis celles qu'il suit.
	 */
	filterStopDeparture?: (departure: StopDeparture, journey: Journey) => boolean;
};

/**
 * Plafond de la fenêtre de grâce accordée à une course qui vient d'atteindre son terminus.
 * Doit rester supérieur à la période nominale d'un cycle (bornée à 120 s par index.ts), sinon
 * la publication finale ne se déclenche jamais. Borne l'effet d'une source restée muette
 * plusieurs minutes, qui republierait sinon d'un coup tous les terminus manqués entre-temps.
 */
export const MAX_TERMINUS_GRACE_MS = 120_000;

/**
 * Délai de tolérance par défaut avant d'abandonner les informations d'un TripUpdate disparu du
 * flux. Amortit les producteurs dont le flux est intermittent : une course qui en sort le temps
 * d'un cycle ne perd pas son retard ni ses arrêts supprimés.
 */
export const DEFAULT_TRIP_UPDATE_TTL_MS = 10 * 60 * 1000;

export type RealtimeEntityType = "TRIP_UPDATES" | "VEHICLE_POSITIONS" | "TRIP_MODIFICATIONS";

export class Source {
	gtfs?: Gtfs;
	linePaths = new Map<string, EncodedLinePath>();
	realtimeFeedCache = new Map<string, { at: number; contents: RealtimeFeedContents }>();
	/** Instant (epoch ms) du dernier cycle de calcul réussi. Undefined avant le premier. */
	lastComputeAtMs?: number;
	/**
	 * Réseaux réellement alimentés par la source, observés au fil des courses publiées. Une source
	 * peut en alimenter plusieurs ({@link SourceOptions.getNetworkRef} dépendant de la course), ce que
	 * la seule configuration ne permet pas de déterminer.
	 */
	observedNetworkRefs = new Set<string>();
	/** Types d'entités observés dans chaque flux temps réel, indexés par href. */
	observedRealtimeEntityTypes = new Map<string, Set<RealtimeEntityType>>();
	/**
	 * Clés des courses portant une déviation, dans {@link Gtfs.journeys}. Elles ne sont qu'une poignée
	 * parmi des dizaines de milliers : les suivre évite de balayer toutes les courses à chaque cycle
	 * pour trouver celles dont la déviation a expiré.
	 */
	modifiedJourneyKeys = new Set<string>();
	/**
	 * Arrêts créés à la volée par le flux temps réel et desservis par une course déviée, chacun
	 * érigé en station : ils n'existent dans aucun fichier du GTFS statique, mais un voyageur doit
	 * pouvoir les trouver sur la carte et y consulter ses passages. Recalculés à chaque cycle.
	 */
	realtimeStopAreas = new Map<string, StopArea>();

	constructor(
		readonly id: string,
		readonly options: SourceOptions,
	) {}

	/**
	 * Durée écoulée depuis le dernier calcul réussi, plafonnée. Une course dont le terminus a été
	 * franchi dans cette fenêtre est publiée une dernière fois, ancrée à son terminus, pour ne pas
	 * disparaître de la carte avant d'y être arrivée.
	 */
	getTerminusGraceMs(nowMs: number) {
		if (this.lastComputeAtMs === undefined) return 0;
		return Math.min(Math.max(0, nowMs - this.lastComputeAtMs), MAX_TERMINUS_GRACE_MS);
	}

	/**
	 * Imports the latest GTFS resource available for this source. Overwrites the
	 * current resource if exists.
	 * @param updating Whether this is an update or an initial import (log-only).
	 */
	async importGtfs(updating = false) {
		const watch = createStopWatch();
		const sourceId = padSourceId(this.id);
		const updateLog = console.draft("%s     ► %s GTFS resource...", updating ? "Updating" : "Importing", sourceId);

		const resourceDirectory = await mkdtemp(join(tmpdir(), `bt-gtfs_${this.id}_`));

		try {
			updateLog("%s 1/3 ► Downloading GTFS resource into temporary directory...", sourceId);
			await downloadGtfs(this, resourceDirectory);

			updateLog("%s 2/3 ► Loading GTFS resource contents into memory...", sourceId);
			const gtfs: Gtfs = {
				...(await importGtfs(resourceDirectory, this.options.gtfsOptions)),
				importedAt: Temporal.Now.instant(),
				...(await getStaleness(this.options.staticResourceHref, this.options.staticAuth ?? this.options.auth).catch(
					() => ({
						lastModified: null,
						etag: null,
					}),
				)),
			};

			this.linePaths = buildEncodedLinePaths(this, gtfs);

			updateLog("%s 3/3 ► Pre-computing scheduled journeys...", sourceId);
			if (typeof this.options.excludeScheduled !== "boolean") {
				const now = Temporal.Now.zonedDateTimeISO();
				const dates = [...(now.hour < 6 ? [now.subtract({ days: 1 }).toPlainDate()] : []), now.toPlainDate()];

				for (const trip of gtfs.trips.values()) {
					if (this.options.excludeScheduled?.(trip)) continue;

					const journeys = dates.map((date) => trip.getScheduledJourney(date));
					for (const journey of journeys) {
						if (journey === undefined) continue;
						if (now.epochMilliseconds > journey.lastCallDepartureMs) continue;
						gtfs.journeys.set(`${journey.date.toString()}-${journey.trip.id}`, journey);
					}
				}
			}

			updateLog(
				"%s     ✓ Resource %s in %dms - %d journeys and %d line paths were pre-computed.\n",
				sourceId,
				updating ? "updated" : "imported",
				watch.total(),
				gtfs.journeys.size,
				this.linePaths.size,
			);
			this.gtfs = gtfs;
			return true;
		} catch (cause) {
			updateLog(
				"%s     ✘ Something wrong occurred while %s the resource.",
				sourceId,
				updating ? "updating" : "importing",
			);
			throw new Error(`Failed to load GTFS resource for '${this.id}'.`, {
				cause,
			});
		} finally {
			await rm(resourceDirectory, { recursive: true, force: true });
		}
	}

	/**
	 * Checks whether the current GTFS resource needs to be updated (either based
	 * on its import age, or actual freshness indicators). If so, the resource is
	 * automatically updated.
	 */
	async updateGtfs() {
		const sourceId = padSourceId(this.id);
		const updateLog = console.draft("%s ► Checking GTFS resource staleness.", sourceId);

		if (this.gtfs === undefined) {
			updateLog("%s ℹ Resource has not loaded yet (error?), performing a load attempt.", sourceId);
			return this.importGtfs();
		}

		if (this.gtfs.lastModified === null && this.gtfs.etag === null) {
			const delta = Temporal.Now.instant().since(this.gtfs.importedAt).total("minutes");
			if (delta >= 60) {
				updateLog("%s ℹ Current resource is older than 60 minutes (no staleness data): updating resource.", sourceId);
				return this.importGtfs(true);
			}
			updateLog("%s ℹ Current resource is fresh enough (no staleness data).", sourceId);
			return false;
		}

		try {
			updateLog("%s ► Fetching resource staleness at '%s'.", sourceId, this.options.staticResourceHref);
			const staleness = await getStaleness(
				this.options.staticResourceHref,
				this.options.staticAuth ?? this.options.auth,
			);

			if (this.gtfs.lastModified !== staleness.lastModified || this.gtfs.etag !== staleness.etag) {
				updateLog("%s ℹ Fetched staleness is different than current: updating resource.", sourceId);
				return this.importGtfs(true);
			}
			updateLog("%s ℹ Fetched staleness matches current staleness: keeping current resource.", sourceId);
			return false;
		} catch {
			const delta = Temporal.Now.instant().since(this.gtfs.importedAt).total("minutes");
			if (delta >= 60) {
				updateLog(
					"%s ⚠ Failed to fetch resource staleness, and current resource is older than 60 minutes: updating resource.",
					sourceId,
				);
				return this.importGtfs(true);
			}
			updateLog("%s ⚠ Failed to fetch resource staleness, but current resource looks fresh enough.", sourceId);
			return false;
		} finally {
			console.log();
		}
	}

	computeNextJourneys() {
		const sourceId = padSourceId(this.id);
		if (this.gtfs === undefined) {
			console.warn("%s ⚠ Source has no loaded GTFS data, ignoring.", sourceId);
			return;
		}

		const date = Temporal.Now.plainDateISO();

		const updateLog = console.draft("%s ► Computing journeys for date '%s'.", sourceId, date);
		const watch = createStopWatch();

		let computedJourneys = 0;

		if (typeof this.options.excludeScheduled !== "boolean") {
			for (const trip of this.gtfs.trips.values()) {
				if (this.options.excludeScheduled?.(trip)) continue;

				const journey = trip.getScheduledJourney(date);
				if (journey === undefined) continue;

				this.gtfs.journeys.set(`${date.toString()}-${trip.id}`, journey);
				computedJourneys += 1;
			}

			// this.gtfs.journeys.sort((a, b) =>
			// 	Temporal.ZonedDateTime.compare(a.calls[0]!.aimedArrivalTime, b.calls[0]!.aimedArrivalTime),
			// );
		}

		updateLog("%s ✓ Computed %d journeys for date '%s' in %dms.", sourceId, computedJourneys, date, watch.total());
	}

	sweepJourneys() {
		if (this.gtfs === undefined) return;

		const now = Temporal.Now.instant().epochMilliseconds;
		const oldJourneyCount = this.gtfs.journeys.size;

		for (const [id, journey] of this.gtfs.journeys) {
			// Utilise lastCallDepartureMs pour éviter de matérialiser les calls.
			// Si un voyage a des données RT, on vérifie la dernière heure attendue.
			// lastCallDepartureMs est précalculé et évite de matérialiser les calls.
			// Pour les courses RT très en avance, on pourrait sweeper légèrement trop tôt,
			// mais l'écart est négligeable (quelques minutes max) et le gain en perf vaut la peine.
			// La marge vaut le plafond de la fenêtre de grâce : une course dont le terminus vient
			// d'être franchi doit survivre jusqu'au cycle suivant pour y être publiée une dernière fois.
			const lastDepartureMs = journey.lastCallDepartureMs;
			if (now - MAX_TERMINUS_GRACE_MS > lastDepartureMs) {
				this.gtfs.journeys.delete(id);
			}
		}

		console.log(
			"%s ✓ Swept %d outdated vehicle journeys",
			padSourceId(this.id),
			oldJourneyCount - this.gtfs.journeys.size,
		);
	}
}
