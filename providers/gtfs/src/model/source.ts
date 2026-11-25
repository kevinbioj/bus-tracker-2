import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	type DataSourceRealtimeEntityType,
	type EncodedLinePath,
	type PassedCallDetection,
	type StopDeparture,
	toLineRef,
	toServiceJourneyRef,
	toStopPointRef,
	type VehicleJourney,
} from "@bus-tracker/contracts";
import { downloadGtfsArchive, extractGtfs } from "../download/download-gtfs.js";
import type { RealtimeFeedContents } from "../download/download-gtfs-rt.js";
import { type ImportGtfsOptions, importGtfs } from "../import/import-gtfs.js";
import type { SourceAuth } from "../utils/auth.js";
import { fetchFreshness, type ResourceFreshness } from "../utils/fetch-freshness.js";
import { createLogger, type Logger } from "../utils/logger.js";
import { createStopWatch } from "../utils/stop-watch.js";
import { type Gtfs, getJourneyKey } from "./gtfs.js";
import type {
	Alert,
	IdentifiedAlert,
	TripDescriptor,
	TripModifications,
	TripUpdate,
	VehicleDescriptor,
	VehiclePosition,
} from "./gtfs-rt.js";
import type { Journey, JourneyCall } from "./journey.js";
import { buildEncodedLinePaths } from "./line-path.js";
import type { Route } from "./route.js";
import { createServiceWindow, isServiceWindowOutdated } from "./service-window.js";
import type { Stop } from "./stop.js";
import type { StopArea } from "./stop-area.js";
import type { Trip } from "./trip.js";

export type LoadedResource = ResourceFreshness & {
	hash: string;
	checkedAt: Temporal.Instant;
};

export type StalenessProbe = {
	href: string;
	fetchFreshness: (method?: "HEAD" | "GET") => Promise<ResourceFreshness>;
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
	isStaticResourceStale?: (resource: LoadedResource, probe: StalenessProbe) => Promise<boolean>;
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
	/**
	 * Stations dont le tableau propose aussi les prochaines arrivées : toutes (`true`), ou celles
	 * desservies par une route qui satisfait le prédicat. Elles sont publiées même sans départ — un
	 * terminus. Absent : aucune, et une station sans départ n'est pas publiée.
	 */
	stopArrivals?: boolean | ((route: Route) => boolean);
	// --- Additional data acquirance
	mode?: "ALL" | "VP-ONLY" | "VP+TU" | "NO-TU";
	excludeScheduled?: ((trip: Trip) => boolean) | boolean;
	getAheadTime?: (journey?: Journey) => number;
	/**
	 * Réseau d'une course. `trip` est le descripteur de course GTFS-RT de la position ou du TripUpdate
	 * qui la décrit, lorsqu'il y en a un : il porte ce que le flux dit de la course, au-delà du GTFS
	 * statique (route d'une course inconnue, par exemple).
	 */
	getNetworkRef: (journey?: Journey, vehicle?: VehicleDescriptor, trip?: TripDescriptor) => string;
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
	isNonCommercialTripUpdate?: (tripUpdate: TripUpdate) => boolean;
	/**
	 * Retouche une alerte d'info trafic avant sa publication, ou l'écarte en renvoyant `undefined`.
	 * Sert à aligner ses identifiants (routes, arrêts, courses) sur ceux du GTFS de la source.
	 */
	mapAlert?: (alert: Alert, gtfs: Gtfs) => Alert | undefined;
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
	/**
	 * Règle métier jugeant qu'un passage est « potentiellement supprimé » : la course qui l'assure
	 * n'est vraisemblablement pas honorée — aucun véhicule ne lui est attitré au-delà d'un délai
	 * après son départ, et le temps réel qu'elle porte encore est alors fantaisiste. Le contexte
	 * expose la course entière et la desserte visée, pour y exprimer librement tout critère métier.
	 * Vrai : le passage est publié avec `potentiallyCanceled` et affiché comme tel. N'est évaluée
	 * que pour les courses connues du processeur (présentes dans `gtfs.journeys`).
	 */
	isPotentiallyCanceled?: (context: PotentiallyCanceledContext) => boolean;
};

/**
 * Contexte d'évaluation de {@link SourceOptions.isPotentiallyCanceled} : tout ce qui peut fonder
 * un critère métier sur la « non-honoration » d'une course — véhicule attitré ou non, âge du
 * départ, temps réel porté, desserte visée.
 */
export type PotentiallyCanceledContext = {
	/** Course du passage, telle que le processeur la connaît, état temps réel compris. */
	journey: Journey;
	/**
	 * Desserte de la course à l'arrêt du tableau. Absente lorsque la course n'a pas d'état
	 * matérialisé à cet arrêt (aucun temps réel, aucune déviation).
	 */
	call: JourneyCall | undefined;
	/** Quai effectivement desservi : celui désigné par le temps réel, à défaut l'arrêt théorique. */
	stop: Stop;
	/** Instant du calcul (epoch ms). */
	nowMs: number;
	/** Heure de passage théorique (epoch ms) : départ, ou arrivée dans le sens « arrivées ». */
	aimedTimeMs: number;
	/** Heure de passage temps réel (epoch ms), lorsqu'elle existe. */
	expectedTimeMs: number | undefined;
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

const RESOURCE_RECHECK_MINUTES = 60;

function isResourceCheckExpired(resource: LoadedResource) {
	return Temporal.Now.instant().since(resource.checkedAt).total("minutes") >= RESOURCE_RECHECK_MINUTES;
}

export async function isStaleByFreshness(resource: LoadedResource, probe: StalenessProbe) {
	if (resource.lastModified === null && resource.etag === null) return isResourceCheckExpired(resource);
	const published = await probe.fetchFreshness();
	return published.lastModified !== resource.lastModified || published.etag !== resource.etag;
}

const staticStopAreaIds = new WeakMap<Gtfs, Map<string, string>>();

export class Source {
	gtfs?: Gtfs;
	resource?: LoadedResource;
	failedResource?: LoadedResource;
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
	observedRealtimeEntityTypes = new Map<string, Set<DataSourceRealtimeEntityType>>();
	/**
	 * Clés des courses portant une déviation, dans {@link Gtfs.journeys}. Elles ne sont qu'une poignée
	 * parmi des dizaines de milliers : les suivre évite de balayer toutes les courses à chaque cycle
	 * pour trouver celles dont la déviation a expiré.
	 */
	modifiedJourneyKeys = new Set<string>();
	/**
	 * Clés des courses supprimées par le flux temps réel, dans le format de {@link Gtfs.journeys}. Le
	 * tableau des passages, calculé à la demande entre deux cycles, doit les annoncer supprimées plutôt
	 * que les présenter à leur horaire théorique. Recalculées à chaque cycle.
	 */
	canceledJourneyKeys = new Set<string>();
	computedJourneyPublications = new Map<string, string>();
	/**
	 * Arrêts créés à la volée par le flux temps réel et desservis par une course déviée : ils
	 * n'existent dans aucun fichier du GTFS statique, mais un voyageur doit pouvoir les trouver sur la
	 * carte et y consulter ses passages. Rattaché à une station du GTFS, un tel arrêt y figure comme
	 * un quai de plus — la station complétée prime alors sur celle de {@link Gtfs.stopAreas}, sous le
	 * même identifiant ; sinon, il est érigé en sa propre station. Recalculés à chaque cycle.
	 */
	realtimeStopAreas = new Map<string, StopArea>();
	/**
	 * Alertes d'info trafic lues au dernier cycle, telles que le flux les publie : leurs identifiants
	 * ne sont résolus en références publiées qu'au moment de les publier.
	 */
	serviceAlerts: IdentifiedAlert[] = [];

	readonly realtimeResources: RealtimeResource[];
	readonly staticAuth: SourceAuth | undefined;
	readonly realtimeAuth: SourceAuth | undefined;
	readonly log: Logger;

	constructor(
		readonly id: string,
		readonly options: SourceOptions,
	) {
		this.realtimeResources = (options.realtimeResourceHrefs ?? []).map((resource) =>
			typeof resource === "string" ? { href: resource } : resource,
		);
		this.staticAuth = options.staticAuth ?? options.auth;
		this.realtimeAuth = options.realtimeAuth ?? options.auth;
		this.log = createLogger(id);
	}

	get isAuthenticated() {
		return this.staticAuth !== undefined || this.realtimeAuth !== undefined;
	}

	tripRefOf(tripId: string) {
		return this.options.mapTripRef?.(tripId) ?? tripId;
	}

	stopRefIdOf(stopId: string) {
		return this.options.mapStopRef?.(stopId) ?? stopId;
	}

	lineRefIdOf(routeId: string) {
		return this.options.mapLineRef?.(routeId) ?? routeId;
	}

	lineRefOf(networkRef: string, routeId: string) {
		return toLineRef(networkRef, this.lineRefIdOf(routeId));
	}

	stopRefOf(networkRef: string, stopId: string) {
		return toStopPointRef(networkRef, this.stopRefIdOf(stopId));
	}

	journeyRefOf(networkRef: string, tripId: string) {
		return toServiceJourneyRef(networkRef, this.tripRefOf(tripId));
	}

	/**
	 * Réseau d'une course, tel que la configuration le détermine. Une source peut en alimenter plusieurs
	 * (`getNetworkRef` dépendant de la course — la SNCF, par exploitant), si bien qu'un arrêt n'a de
	 * réseau qu'à travers les courses qui le desservent.
	 *
	 * `getNetworkRef` attend une course datée : à défaut, une course théorique est fabriquée pour la
	 * question, et la réponse est gardée par le résolveur — elle dépend de la course, pas de sa date.
	 * Une course que la configuration écarte n'a pas de réseau : `undefined`.
	 */
	createNetworkResolver() {
		const cache = new Map<Trip, string | undefined>();
		const today = Temporal.Now.plainDateISO();

		return (trip: Trip, journey?: Journey): string | undefined => {
			if (journey !== undefined)
				return this.options.getNetworkRef(journey, journey.vehicleDescriptor, journey.tripDescriptor) ?? undefined;

			if (cache.has(trip)) return cache.get(trip);
			const networkRef = this.options.getNetworkRef(trip.getScheduledJourney(today, true)) ?? undefined;
			cache.set(trip, networkRef);
			return networkRef;
		};
	}

	/**
	 * Réseaux connus de la source. Les refs observées priment ; à défaut, une configuration dont
	 * `getNetworkRef` est constante répond sans course et permet d'annoncer la source dès le démarrage.
	 * Une configuration dépendant de la course renvoie `undefined` ou lève : la source attend alors sa
	 * première publication de véhicule.
	 */
	networkRefs() {
		const networkRefs = new Set(this.observedNetworkRefs);

		if (networkRefs.size === 0) {
			try {
				const networkRef = this.options.getNetworkRef();
				if (typeof networkRef === "string" && networkRef.length > 0) networkRefs.add(networkRef);
			} catch {}
		}

		return [...networkRefs].sort();
	}

	stopAreaIdOf(stopId: string) {
		for (const stopArea of this.realtimeStopAreas.values()) {
			if (stopArea.stops.some(({ id }) => id === stopId)) return stopArea.id;
		}

		const gtfs = this.gtfs;
		if (gtfs === undefined) return undefined;

		let stopAreaIds = staticStopAreaIds.get(gtfs);
		if (stopAreaIds === undefined) {
			stopAreaIds = new Map(
				gtfs.stopAreas.values().flatMap((stopArea) => stopArea.stops.map(({ id }) => [id, stopArea.id] as const)),
			);
			staticStopAreaIds.set(gtfs, stopAreaIds);
		}
		return stopAreaIds.get(stopId);
	}

	/**
	 * Durée écoulée depuis le dernier calcul réussi, plafonnée. Une course dont le terminus a été
	 * franchi dans cette fenêtre est publiée une dernière fois, ancrée à son terminus, pour ne pas
	 * disparaître de la carte avant d'y être arrivée.
	 */
	getTerminusGraceMs(nowMs: number) {
		if (this.lastComputeAtMs === undefined) return 0;
		return Math.min(Math.max(0, nowMs - this.lastComputeAtMs), MAX_TERMINUS_GRACE_MS);
	}

	async importGtfs({ updating = false, keepIfUnchanged = false } = {}) {
		const watch = createStopWatch();

		const resourceDirectory = await mkdtemp(join(tmpdir(), `bt-gtfs_${this.id}_`));

		try {
			const serviceWindow = createServiceWindow(Temporal.Now.plainDateISO());

			const archivePath = join(resourceDirectory, "resource.zip");
			const archive = await downloadGtfsArchive(this, archivePath);
			const checkedAt = Temporal.Now.instant();
			if (archive.hash === this.failedResource?.hash) {
				this.failedResource = { ...archive, checkedAt };
				this.log.info(`GTFS unchanged since its failed import, skipped (checked in ${watch.total()}ms)`);
				return false;
			}
			if (keepIfUnchanged && archive.hash === this.resource?.hash) {
				this.resource = { ...archive, checkedAt };
				this.failedResource = undefined;
				this.log.info(`GTFS unchanged upstream, kept the loaded one (checked in ${watch.total()}ms)`);
				return false;
			}

			try {
				await extractGtfs(archivePath, resourceDirectory);

				const gtfs: Gtfs = {
					...(await importGtfs(resourceDirectory, { ...this.options.gtfsOptions, serviceWindow })),
					importedAt: Temporal.Now.instant(),
				};

				this.linePaths = buildEncodedLinePaths(this, gtfs);

				const now = Temporal.Now.zonedDateTimeISO();
				const dates = [...(now.hour < 6 ? [now.subtract({ days: 1 }).toPlainDate()] : []), now.toPlainDate()];
				this.scheduleJourneys(gtfs, dates, now.epochMilliseconds);

				this.log.info(
					`GTFS ${updating ? "updated" : "imported"} in ${watch.total()}ms: ${gtfs.journeys.size} journeys, ${this.linePaths.size} line paths (window ${serviceWindow.from} → ${serviceWindow.to})`,
				);
				this.gtfs = gtfs;
				this.resource = { ...archive, checkedAt: gtfs.importedAt };
				this.failedResource = undefined;
				return true;
			} catch (error) {
				this.failedResource = { ...archive, checkedAt };
				throw error;
			}
		} finally {
			await rm(resourceDirectory, { recursive: true, force: true });
		}
	}

	async updateGtfs() {
		if (this.failedResource !== undefined) {
			if (!(await this.isResourceStale(this.failedResource))) return false;
			this.log.info("GTFS changed upstream since its failed import, retrying");
			return this.importGtfs({ updating: this.gtfs !== undefined, keepIfUnchanged: true });
		}

		if (this.gtfs === undefined || this.resource === undefined) {
			this.log.info("GTFS not loaded yet, importing");
			return this.importGtfs();
		}

		const serviceWindow = this.gtfs.serviceWindow;
		if (serviceWindow !== undefined && isServiceWindowOutdated(serviceWindow, Temporal.Now.plainDateISO())) {
			this.log.info(`GTFS service window ended on ${serviceWindow.to}, updating`);
			return this.importGtfs({ updating: true });
		}

		if (!(await this.isResourceStale(this.resource))) return false;

		this.log.info("GTFS changed upstream, updating");
		return this.importGtfs({ updating: true, keepIfUnchanged: true });
	}

	private async isResourceStale(resource: LoadedResource) {
		const isStaticResourceStale = this.options.isStaticResourceStale ?? isStaleByFreshness;
		const probe: StalenessProbe = {
			href: this.options.staticResourceHref,
			fetchFreshness: (method) => fetchFreshness(this.options.staticResourceHref, this.staticAuth, method),
		};

		return isStaticResourceStale(resource, probe).catch((error: unknown) => {
			this.log.warn("Failed to check GTFS staleness, relying on the last check", error);
			return isResourceCheckExpired(resource);
		});
	}

	/**
	 * Pré-calcule les courses théoriques des dates données, hormis celles déjà achevées et celles que
	 * la source tient déjà (une course rattachée au temps réel garde son état).
	 */
	private scheduleJourneys(gtfs: Gtfs, dates: Temporal.PlainDate[], nowMs: number) {
		if (this.options.excludeScheduled === true) return 0;

		let scheduledJourneys = 0;
		for (const trip of gtfs.trips.values()) {
			if (typeof this.options.excludeScheduled === "function" && this.options.excludeScheduled(trip)) continue;

			for (const date of dates) {
				const key = getJourneyKey(date, trip.id);
				if (gtfs.journeys.has(key)) continue;

				const journey = trip.getScheduledJourney(date);
				if (journey === undefined || nowMs > journey.lastCallDepartureMs) continue;

				gtfs.journeys.set(key, journey);
				scheduledJourneys += 1;
			}
		}
		return scheduledJourneys;
	}

	computeNextJourneys() {
		if (this.gtfs === undefined) {
			this.log.warn("No GTFS loaded, skipped scheduling the next day");
			return;
		}

		const date = Temporal.Now.plainDateISO();
		const watch = createStopWatch();
		const computedJourneys = this.scheduleJourneys(this.gtfs, [date], Date.now());
		this.log.info(`Scheduled ${computedJourneys} journeys for ${date} in ${watch.total()}ms`);
	}

	sweepJourneys() {
		if (this.gtfs === undefined) return;

		const now = Temporal.Now.instant().epochMilliseconds;
		const oldJourneyCount = this.gtfs.journeys.size;

		for (const [id, journey] of this.gtfs.journeys) {
			// La marge vaut le plafond de la fenêtre de grâce : une course dont le terminus vient d'être
			// franchi doit survivre jusqu'au cycle suivant pour y être publiée une dernière fois.
			if (now - MAX_TERMINUS_GRACE_MS > journey.lastCallDepartureMs) {
				this.gtfs.journeys.delete(id);
			}
		}

		const sweptCount = oldJourneyCount - this.gtfs.journeys.size;
		if (sweptCount > 0) this.log.info(`Swept ${sweptCount} outdated journeys`);
	}
}
