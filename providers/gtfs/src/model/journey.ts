import type { LinePath, VehicleJourneyCallFlags, VehicleJourneyPosition } from "@bus-tracker/contracts";

import { groupBy } from "../utils/group-by.js";
import type { Gtfs } from "./gtfs.js";
import type { StopTimeUpdate, VehicleDescriptor } from "./gtfs-rt.js";
import type { Shape } from "./shape.js";
import type { Stop } from "./stop.js";
import type { Trip } from "./trip.js";
import { buildModifiedCalls, computeCancelledCallRanges, type TripModificationPlan } from "./trip-modification.js";

export type JourneyCall = {
	aimedArrivalTime: number;
	expectedArrivalTime?: number;
	aimedDepartureTime: number;
	expectedDepartureTime?: number;
	stop: Stop;
	sequence: number;
	platform?: string;
	distanceTraveled?: number;
	status: "SCHEDULED" | "UNSCHEDULED" | "SKIPPED";
	/**
	 * Origine de l'arrêt dans une course déviée : ajouté par la déviation, ou retiré par elle et
	 * conservé pour mémoire. Détermine le statut de base auquel l'arrêt revient à chaque
	 * application d'un TripUpdate, faute de quoi la déviation serait effacée par le temps réel.
	 */
	modification?: "ADDED" | "REMOVED";
	flags: VehicleJourneyCallFlags[];
	headsign?: string;
};

export type JourneyPosition = {
	latitude: number;
	longitude: number;
	atStop: boolean;
	type: "GPS" | "COMPUTED";
	recordedAt: Temporal.Instant;
};

const VEHICLE_DESCRIPTOR_TTL_MS = 5 * 60 * 1000;

/**
 * Écart au-delà duquel un point du tracé théorique est tenu pour réellement abandonné. En deçà, le
 * tracé de remplacement le longe : le signaler comme abandonné ferait doublon, deux tracés d'un
 * même itinéraire ne coïncidant jamais au mètre près.
 */
const DETOUR_OVERLAP_TOLERANCE_M = 20;

/** En deçà, le point de raccord serait confondu avec l'extrémité qu'il est censé souder. */
const JOIN_MIN_DISTANCE_M = 0.5;

/**
 * Soude une portion abandonnée au tracé de remplacement, en faisant partir et finir la portion sur
 * la projection de ses extrémités sur celui-ci.
 *
 * Sans cette soudure, le ruban s'arrêterait à l'écart de l'itinéraire suivi — jusqu'à la tolérance
 * de recouvrement — et laisserait un trou à l'endroit même où le véhicule le quitte puis le
 * retrouve, c'est-à-dire là où la déviation se lit.
 */
function joinToShape(points: [number, number][], detourShape: Shape): [number, number][] {
	const [firstLatitude, firstLongitude] = points[0]!;
	const [lastLatitude, lastLongitude] = points[points.length - 1]!;

	// Une extrémité déjà posée sur le tracé de remplacement n'a rien à raccorder : la ressouder
	// n'ajouterait qu'un point confondu avec elle.
	const start = detourShape.projectPosition(firstLatitude, firstLongitude);
	const end = detourShape.projectPosition(lastLatitude, lastLongitude);

	return [
		...(start !== undefined && start.distance > JOIN_MIN_DISTANCE_M
			? [[start.latitude, start.longitude] as [number, number]]
			: []),
		...points,
		...(end !== undefined && end.distance > JOIN_MIN_DISTANCE_M
			? [[end.latitude, end.longitude] as [number, number]]
			: []),
	];
}

/**
 * Ne retient d'un tracé que ce qui s'écarte effectivement du tracé de remplacement, en le scindant
 * autant de fois qu'il le faut : une déviation ne quitte souvent l'itinéraire que sur une fraction
 * de la portion qu'elle prive de desserte, et emprunte le reste à l'identique.
 *
 * Chaque portion retenue est étendue d'un point de part et d'autre, puis raccordée au tracé de
 * remplacement par {@link joinToShape}.
 */
function splitAwayFromShape(points: [number, number][], detourShape: Shape) {
	const segments: [number, number][][] = [];
	let awaySince: number | undefined;

	for (let index = 0; index < points.length; index++) {
		const [latitude, longitude] = points[index]!;

		if (detourShape.distanceToPosition(latitude, longitude) > DETOUR_OVERLAP_TOLERANCE_M) {
			awaySince ??= index;
			continue;
		}

		if (awaySince !== undefined) {
			segments.push(points.slice(Math.max(0, awaySince - 1), index + 1));
			awaySince = undefined;
		}
	}

	if (awaySince !== undefined) {
		segments.push(points.slice(Math.max(0, awaySince - 1)));
	}

	return segments.filter((segment) => segment.length > 1).map((segment) => joinToShape(segment, detourShape));
}

/**
 * Statut auquel un arrêt revient en l'absence d'information temps réel le concernant. Un arrêt
 * issu d'une déviation n'a pas d'existence théorique : le sien ne peut pas être « à l'horaire ».
 */
function getBaseCallStatus(call: JourneyCall): JourneyCall["status"] {
	if (call.modification === "ADDED") return "UNSCHEDULED";
	if (call.modification === "REMOVED") return "SKIPPED";
	return "SCHEDULED";
}

/** Recul (exprimé en temps de rattrapage) au-delà duquel la donnée temps réel est jugée aberrante : le recul est accepté. */
const POSITION_GUARD_MAX_LAG_MS = 5 * 60 * 1000;
/** Durée maximale d'un gel continu, quelle que soit l'amplitude des reculs successifs. */
const POSITION_GUARD_MAX_FREEZE_MS = 5 * 60 * 1000;
/** Fraîcheur maximale de l'état gelé (cycle manqué, reprise après une séquence de positions GPS). */
const POSITION_GUARD_TTL_MS = 3 * 60 * 1000;

type PositionGuardState = {
	/** Distance curviligne (m) de la dernière position publiée — la grandeur dont on garantit la monotonie. */
	distanceTraveled: number;
	/** La position publiée telle quelle, réémise à l'identique pendant le gel. */
	position: VehicleJourneyPosition;
	/** Instant du dernier cycle ayant utilisé cet état (epoch ms). */
	updatedAtMs: number;
	/** Début du gel continu en cours ; undefined si le dernier cycle a publié la position calculée. */
	frozenSinceMs: number | undefined;
};

/**
 * Heure d'arrivée à l'arrêt `index`, bornée par la plus petite heure connue parmi les arrêts
 * ultérieurs. Si un arrêt ultérieur a un temps réel antérieur à l'heure théorique de l'arrêt visé,
 * le bus y sera forcément avant ce temps — sans cette borne, le ratio d'interpolation serait
 * sous-estimé.
 */
export function getBoundedArrivalMs(calls: JourneyCall[], index: number) {
	const call = calls[index]!;
	let arrivalMs = call.expectedArrivalTime ?? call.aimedArrivalTime;
	for (let i = index + 1; i < calls.length; i++) {
		const t = calls[i]!.expectedArrivalTime ?? calls[i]!.aimedArrivalTime;
		if (t < arrivalMs) arrivalMs = t;
	}
	return arrivalMs;
}

/**
 * Estime l'instant (epoch ms) auquel la course atteindrait `distance` selon l'horaire courant.
 * Inverse de l'interpolation de {@link Journey.computePosition}, dont elle réutilise le bornage
 * d'arrivée pour ne pas en diverger. Retourne undefined si la distance est hors de la course.
 */
function estimateTimeAtDistance(calls: JourneyCall[], distance: number) {
	for (let i = 0; i < calls.length - 1; i++) {
		const currentCall = calls[i]!;
		const from = currentCall.distanceTraveled;
		const to = calls[i + 1]!.distanceTraveled;
		if (from === undefined || to === undefined || distance < from || distance > to) continue;

		const departureMs = currentCall.expectedDepartureTime ?? currentCall.aimedDepartureTime;
		if (to <= from) return departureMs;

		const arrivalMs = getBoundedArrivalMs(calls, i + 1);
		return departureMs + (arrivalMs - departureMs) * ((distance - from) / (to - from));
	}
	return undefined;
}

export class Journey {
	private bearing: number | undefined;
	private _vehicleDescriptor: VehicleDescriptor | undefined;
	private _vehicleDescriptorUpdatedAt: number | undefined;
	private _calls: JourneyCall[] | null = null;
	private _hasRealtime = false;
	private _positionGuard: PositionGuardState | undefined;
	private _modificationPlan: TripModificationPlan | undefined;
	/** Cache du tracé abandonné : `null` signifie « calculé, la déviation n'en abandonne aucun ». */
	private _cancelledPath: LinePath | null | undefined;
	/** Bornes théoriques, mémorisées pour restaurer l'état initial quand le temps réel expire. */
	private readonly aimedFirstCallArrivalMs: number;
	private readonly aimedLastCallDepartureMs: number;
	/** Instant (epoch ms) du dernier VehiclePosition reçu pour cette course. */
	lastVehiclePositionAtMs: number | undefined;
	/** Instant (epoch ms) du dernier cycle ayant appliqué un TripUpdate à cette course. */
	lastTripUpdateAtMs: number | undefined;
	/** Instant (epoch ms) du dernier cycle où une déviation a été vue dans le flux. */
	lastModificationAtMs: number | undefined;
	/** Clé sous laquelle la course a été publiée pour la dernière fois depuis son horaire (théorique ou TripUpdate). */
	lastPublishedKey: string | undefined;

	constructor(
		readonly id: string,
		readonly trip: Trip,
		readonly date: Temporal.PlainDate,
		/** Heure d'arrivée au premier arrêt (epoch ms). Initialisé sur l'heure théorique, mis à jour par updateJourney avec l'heure temps réel. */
		public firstCallArrivalMs: number,
		/** Heure de départ au dernier arrêt (epoch ms). Initialisé sur l'heure théorique, mis à jour par updateJourney avec l'heure temps réel. */
		public lastCallDepartureMs: number,
	) {
		this.aimedFirstCallArrivalMs = firstCallArrivalMs;
		this.aimedLastCallDepartureMs = lastCallDepartureMs;
	}

	/**
	 * Tableau des appels de la journée. Calculé à la demande (lazy) et mis en cache.
	 * Utilisé uniquement quand le voyage est dans la fenêtre active ou a des données temps réel.
	 */
	get calls(): JourneyCall[] {
		if (this._calls === null) {
			const scheduledCalls = this.trip.computeCallsForDate(this.date);
			this._calls =
				this._modificationPlan !== undefined
					? (buildModifiedCalls(scheduledCalls, this._modificationPlan) ?? scheduledCalls)
					: scheduledCalls;
		}
		return this._calls;
	}

	/** Tracé effectivement suivi : celui de la déviation en cours, à défaut celui de la course. */
	get shape(): Shape | undefined {
		return this._modificationPlan?.shape ?? this.trip.shape;
	}

	/**
	 * Portions du tracé théorique que la déviation en cours fait abandonner à la course, afin de les
	 * signaler comme telles sur la carte.
	 *
	 * Uniquement lorsque la déviation fournit son propre tracé : sans lui, le véhicule est réputé
	 * suivre l'itinéraire d'origine, dont aucune portion n'est donc abandonnée.
	 */
	get cancelledPath(): LinePath | undefined {
		if (this._cancelledPath === undefined) {
			this._cancelledPath = this.computeCancelledPath() ?? null;
		}
		return this._cancelledPath ?? undefined;
	}

	private computeCancelledPath(): LinePath | undefined {
		const plan = this._modificationPlan;
		const tripShape = this.trip.shape;
		if (plan === undefined || plan.shape === undefined || tripShape === undefined) return;

		const scheduledCalls = this.trip.computeCallsForDate(this.date);
		const ranges = computeCancelledCallRanges(scheduledCalls, plan);
		if (ranges.length === 0) return;

		const segments = ranges.flatMap(([fromIndex, toIndex]) => {
			const segment = tripShape.sliceBetweenPositions(scheduledCalls[fromIndex]!.stop, scheduledCalls[toIndex]!.stop);
			return splitAwayFromShape(segment, plan.shape!);
		});

		return segments.length > 0 ? { segments } : undefined;
	}

	/** Vrai si une déviation est appliquée à la course. */
	hasModifications() {
		return this._modificationPlan !== undefined;
	}

	/**
	 * Applique une déviation à la course. Les arrêts ne sont recalculés que si son contenu a changé :
	 * une déviation est republiée à chaque cycle, en recalculer les arrêts à chaque fois effacerait
	 * le temps réel appliqué au cycle précédent.
	 */
	applyModifications(plan: TripModificationPlan, nowMs: number) {
		if (this._modificationPlan?.revision !== plan.revision) {
			this._modificationPlan = plan;
			this._calls = null;
			this._cancelledPath = undefined;
			this.refreshBounds();
		}
		this.lastModificationAtMs = nowMs;
	}

	/**
	 * Abandonne la déviation appliquée à la course et restaure sa desserte théorique. Un flux
	 * GTFS-RT étant un instantané complet, une déviation qui en disparaît a été levée.
	 *
	 * @returns true si une déviation a été abandonnée.
	 */
	clearModifications() {
		if (this._modificationPlan === undefined) return false;

		this._modificationPlan = undefined;
		this.lastModificationAtMs = undefined;
		this._calls = null;
		this._cancelledPath = undefined;
		this._hasRealtime = false;
		this.firstCallArrivalMs = this.aimedFirstCallArrivalMs;
		this.lastCallDepartureMs = this.aimedLastCallDepartureMs;
		return true;
	}

	/**
	 * Recale les bornes de la course sur ses arrêts courants. Une déviation peut insérer un arrêt
	 * avant le premier ou propager un retard jusqu'au terminus : les bornes, dont dépendent la
	 * fenêtre de publication et le balayage, ne sont plus celles de l'horaire théorique.
	 */
	private refreshBounds() {
		const calls = this.calls;
		const firstCall = calls[0];
		const lastCall = calls[calls.length - 1];
		if (firstCall === undefined || lastCall === undefined) return;

		this.firstCallArrivalMs = firstCall.expectedArrivalTime ?? firstCall.aimedArrivalTime;
		this.lastCallDepartureMs = lastCall.expectedDepartureTime ?? lastCall.aimedDepartureTime;
	}

	/**
	 * Libère l'état accumulé par les voyages terminés : le guard de position systématiquement,
	 * et le cache des calls s'ils n'ont pas de données temps réel. À appeler après chaque cycle de
	 * calcul. Les voyages encore actifs ou futurs conservent leur cache pour éviter de re-calculer
	 * computeCallsForDate() à chaque cycle.
	 */
	releaseUnmodifiedCalls(nowMs: number) {
		if (nowMs > this.lastCallDepartureMs) {
			this._positionGuard = undefined;
			if (!this._hasRealtime) {
				this._calls = null;
			}
		}
	}

	/**
	 * Abandonne les informations temps réel d'une course dont le TripUpdate a disparu du flux depuis
	 * plus de `ttlMs`, en restaurant l'horaire théorique. Un flux GTFS-RT est un instantané complet :
	 * une course absente n'a plus d'information temps réel, y compris ses exceptions de desserte.
	 *
	 * Sans cela, un arrêt SKIPPED resterait affiché comme supprimé jusqu'à la fin de la course alors
	 * que le producteur a levé la perturbation — rien ne vient le corriger quand le flux ne porte
	 * aucun horaire temps réel, puisque {@link updateJourney} n'est plus appelé pour cette course.
	 *
	 * @returns true si l'état temps réel a été abandonné.
	 */
	expireStaleRealtime(nowMs: number, ttlMs: number) {
		if (this.lastTripUpdateAtMs === undefined) return false;
		if (nowMs - this.lastTripUpdateAtMs <= ttlMs) return false;

		this.dropRealtime();
		return true;
	}

	/**
	 * Abandonne inconditionnellement l'état temps réel de la course et restaure son horaire théorique.
	 * Employé lorsque le temps réel est jugé faux plutôt qu'absent — une course dont la position s'est
	 * figée alors que son TripUpdate continue de dériver, par exemple.
	 */
	dropRealtime() {
		this.lastTripUpdateAtMs = undefined;
		this._hasRealtime = false;
		// Les calls sont re-calculés à la demande depuis l'horaire théorique.
		this._calls = null;

		// Une déviation n'est pas une prédiction : elle ne périme pas avec le TripUpdate qui la
		// traversait, et les bornes restent celles de la desserte déviée.
		if (this._modificationPlan !== undefined) {
			this.refreshBounds();
			return;
		}

		this.firstCallArrivalMs = this.aimedFirstCallArrivalMs;
		this.lastCallDepartureMs = this.aimedLastCallDepartureMs;
	}

	get vehicleDescriptor(): VehicleDescriptor | undefined {
		if (this._vehicleDescriptorUpdatedAt === undefined) return undefined;
		if (Date.now() - this._vehicleDescriptorUpdatedAt > VEHICLE_DESCRIPTOR_TTL_MS) return undefined;
		return this._vehicleDescriptor;
	}

	setVehicleDescriptor(descriptor: VehicleDescriptor | undefined, updatedAt: number) {
		this._vehicleDescriptor = descriptor;
		this._vehicleDescriptorUpdatedAt = updatedAt;
	}

	guessPosition(at: Temporal.Instant): VehicleJourneyPosition {
		const calls = this.calls.filter((call) => call.status !== "SKIPPED");
		const position = this.computePosition(calls, at);
		return this.applyPositionGuard(position, calls, at.epochMilliseconds);
	}

	private computePosition(calls: JourneyCall[], at: Temporal.Instant): VehicleJourneyPosition {
		if (calls.length === 0) {
			return this.getJourneyPositionAt(this.calls[0]!);
		}

		const atMs = at.epochMilliseconds;
		const firstCall = calls[0]!;
		const lastCall = calls[calls.length - 1]!;

		// 1. Before the journey starts
		const firstDepartureMs = firstCall.expectedDepartureTime ?? firstCall.aimedDepartureTime;
		if (atMs <= firstDepartureMs) {
			return this.getJourneyPositionAt(firstCall);
		}

		// 2. After the journey ends
		const lastArrivalMs = lastCall.expectedArrivalTime ?? lastCall.aimedArrivalTime;
		if (atMs >= lastArrivalMs) {
			return this.getJourneyPositionAt(lastCall);
		}

		// 3. During the journey
		const currentCallIndex = calls.findLastIndex((call) => {
			const arrivalMs = call.expectedArrivalTime ?? call.aimedArrivalTime;
			return atMs >= arrivalMs;
		});

		const currentCall = calls[currentCallIndex]!;
		const departureMs = currentCall.expectedDepartureTime ?? currentCall.aimedDepartureTime;

		// At a stop
		if (atMs <= departureMs) {
			return this.getJourneyPositionAt(currentCall);
		}

		// Between stops
		const nextCall = calls[currentCallIndex + 1];

		const shape = this.shape;
		if (shape === undefined || currentCall.distanceTraveled === undefined || nextCall?.distanceTraveled === undefined) {
			return this.getJourneyPositionAt(currentCall);
		}

		const arrivalMs = getBoundedArrivalMs(calls, currentCallIndex + 1);
		const ratio = Math.max(0, Math.min(1, (atMs - departureMs) / (arrivalMs - departureMs)));
		const distanceTraveled =
			currentCall.distanceTraveled + (nextCall.distanceTraveled - currentCall.distanceTraveled) * ratio;

		const point = shape.interpolateAt(distanceTraveled);
		if (point === undefined) {
			return this.getJourneyPositionAt(currentCall);
		}

		this.bearing = point.bearing;

		return {
			latitude: point.latitude,
			longitude: point.longitude,
			bearing: point.bearing,
			atStop: false,
			type: "COMPUTED",
			distanceTraveled,
			recordedAt: at
				.toZonedDateTimeISO(currentCall.stop.timeZone ?? this.trip.route.agency.timeZone)
				.toString({ timeZoneName: "never" }),
		};
	}

	/**
	 * Empêche un véhicule de reculer sur son tracé quand le temps réel révise un retard à la hausse :
	 * la position est alors gelée à sa dernière valeur connue jusqu'à ce que le calcul la rattrape.
	 *
	 * Le gel est abandonné si le rattrapage prendrait plus de {@link POSITION_GUARD_MAX_LAG_MS}
	 * (donnée aberrante : mieux vaut un recul qu'un véhicule figé très longtemps), ou si le gel dure
	 * déjà depuis plus de {@link POSITION_GUARD_MAX_FREEZE_MS} (retard qui monte par petits paliers).
	 */
	private applyPositionGuard(
		position: VehicleJourneyPosition,
		calls: JourneyCall[],
		atMs: number,
	): VehicleJourneyPosition {
		const distanceTraveled = position.distanceTraveled;
		const guard = this._positionGuard;

		// Pas de distance curviligne exploitable (course sans shape ou sans shape_dist_traveled) :
		// deux positions ne sont pas comparables, le guard est inopérant.
		if (distanceTraveled === undefined || !Number.isFinite(distanceTraveled)) {
			this._positionGuard = undefined;
			return position;
		}

		// Premier passage, état périmé, ou progression normale.
		if (
			guard === undefined ||
			atMs - guard.updatedAtMs > POSITION_GUARD_TTL_MS ||
			distanceTraveled >= guard.distanceTraveled
		) {
			this._positionGuard = { distanceTraveled, position, updatedAtMs: atMs, frozenSinceMs: undefined };
			return position;
		}

		const catchUpAtMs = estimateTimeAtDistance(calls, guard.distanceTraveled);
		const lagMs = catchUpAtMs !== undefined ? catchUpAtMs - atMs : Number.POSITIVE_INFINITY;
		const frozenSinceMs = guard.frozenSinceMs ?? atMs;

		if (lagMs >= POSITION_GUARD_MAX_LAG_MS || atMs - frozenSinceMs >= POSITION_GUARD_MAX_FREEZE_MS) {
			this._positionGuard = { distanceTraveled, position, updatedAtMs: atMs, frozenSinceMs: undefined };
			return position;
		}

		// Le calcul vient d'écraser le cap avec celui de la position refusée : on restaure celui du gel.
		this.bearing = guard.position.bearing;
		this._positionGuard = { ...guard, updatedAtMs: atMs, frozenSinceMs };
		return guard.position;
	}

	hasRealtime() {
		// Si les calls sont en mémoire, vérification précise. Sinon, on utilise le flag.
		if (this._calls !== null) {
			return this._calls.some(
				(call) => call.expectedArrivalTime !== undefined || call.expectedDepartureTime !== undefined,
			);
		}
		return this._hasRealtime;
	}

	/**
	 * @param matchByStopId Apparie les `stop_time_update` par identifiant d'arrêt plutôt que par
	 * séquence. Nécessaire quand un producteur décrit une course déviée sans passer par
	 * `modified_trip` : les séquences qu'il émet sont alors celles du GTFS statique, que la
	 * renumérotation de la déviation a rendues caduques.
	 */
	updateJourney(
		gtfs: Gtfs,
		stopTimeUpdates: StopTimeUpdate[],
		appendTripUpdateInformation?: boolean,
		matchByStopId = false,
	) {
		let arrivalDelay: number | undefined;
		let departureDelay: number | undefined;

		const stopTimeUpdatesByStopSequence = groupBy(stopTimeUpdates, (stopTimeUpdate) => stopTimeUpdate.stopSequence);
		const useStopId = matchByStopId || Object.keys(stopTimeUpdatesByStopSequence).length === 0;
		const stopTimeUpdatesByStopId = useStopId
			? groupBy(stopTimeUpdates, (stopTimeUpdate) => stopTimeUpdate.stopId)
			: undefined;

		for (const call of this.calls) {
			if (!appendTripUpdateInformation) {
				// Un arrêt ajouté par une déviation n'a pas d'horaire théorique : l'heure qu'elle annonce
				// est sa seule heure attendue, et doit survivre à l'application d'un TripUpdate.
				const isAdded = call.modification === "ADDED";
				call.expectedArrivalTime = isAdded ? call.aimedArrivalTime : undefined;
				call.expectedDepartureTime = isAdded ? call.aimedDepartureTime : undefined;
				call.platform = call.stop.platformCode;
				call.status = getBaseCallStatus(call);
			}

			// Un arrêt retiré par une déviation ne fait plus partie de la course : aucun stop_time_update
			// ne le décrit, et son horaire n'a pas à entrer dans la propagation des retards.
			if (call.modification === "REMOVED") continue;

			let timeUpdate = useStopId
				? stopTimeUpdatesByStopId![call.stop.id]
				: stopTimeUpdatesByStopSequence[call.sequence];

			// Prevent wrong time assignation on circular lines when all stop events aren't provided
			if (!useStopId && typeof timeUpdate?.stopSequence === "number" && timeUpdate.stopSequence !== call.sequence) {
				timeUpdate = undefined;
			}

			if (timeUpdate?.stopTimeProperties?.assignedStopId) {
				const stop = gtfs.stops.get(timeUpdate.stopTimeProperties.assignedStopId);
				if (stop !== undefined) {
					call.platform = stop.platformCode;
				}
			}

			if (timeUpdate?.scheduleRelationship === "NO_DATA") {
				arrivalDelay = undefined;
				departureDelay = undefined;
				call.status = getBaseCallStatus(call);
				continue;
			}

			if (timeUpdate?.scheduleRelationship === "SKIPPED") {
				if (arrivalDelay !== undefined) {
					call.expectedArrivalTime = call.aimedArrivalTime + arrivalDelay * 1000;
				}

				if (departureDelay !== undefined) {
					call.expectedDepartureTime = call.aimedDepartureTime + departureDelay * 1000;
				}

				call.status = "SKIPPED";
				continue;
			}

			// Ce n'est pas un concept évident à comprendre pour certains producteurs que
			// de remplir ces champs avec les neuronnes qui communiquent correctement.
			const arrivalEvent = timeUpdate?.arrival ?? timeUpdate?.departure;
			const departureEvent = timeUpdate?.departure ?? timeUpdate?.arrival;

			if (typeof arrivalEvent?.time === "number") {
				arrivalDelay = arrivalEvent.time - Math.floor(call.aimedArrivalTime / 1000);
			} else if (typeof arrivalEvent?.delay === "number") {
				arrivalDelay = arrivalEvent.delay;
			}

			if (typeof departureEvent?.time === "number") {
				departureDelay = departureEvent.time - Math.floor(call.aimedDepartureTime / 1000);
			} else if (typeof departureEvent?.delay === "number") {
				departureDelay = departureEvent.delay;
			}

			if (arrivalDelay !== undefined) {
				call.expectedArrivalTime = call.aimedArrivalTime + arrivalDelay * 1000;
			}

			if (departureDelay !== undefined) {
				call.expectedDepartureTime = call.aimedDepartureTime + departureDelay * 1000;
			}

			call.status = getBaseCallStatus(call);
		}

		// Mise à jour du flag RT basée sur l'état réel des calls.
		this._hasRealtime = this._calls!.some(
			(call) => call.expectedArrivalTime !== undefined || call.expectedDepartureTime !== undefined,
		);

		// Mettre à jour les bornes avec les heures temps réel.
		// Utilisé par le sweep et le fast-rejection de getCalls.
		const firstCall = this._calls![0];
		if (firstCall !== undefined) {
			this.firstCallArrivalMs = firstCall.expectedArrivalTime ?? firstCall.aimedArrivalTime;
		}
		const lastCall = this._calls![this._calls!.length - 1];
		if (lastCall !== undefined) {
			this.lastCallDepartureMs = lastCall.expectedDepartureTime ?? lastCall.aimedDepartureTime;
		}
	}

	private getJourneyPositionAt(call: JourneyCall): VehicleJourneyPosition {
		const recordedAtMs = call.expectedArrivalTime ?? call.aimedArrivalTime;

		return {
			latitude: call.stop.latitude,
			longitude: call.stop.longitude,
			bearing: this.bearing,
			atStop: true,
			type: "COMPUTED",
			distanceTraveled: call.distanceTraveled,
			recordedAt: Temporal.Instant.fromEpochMilliseconds(recordedAtMs)
				.toZonedDateTimeISO(call.stop.timeZone ?? this.trip.route.agency.timeZone)
				.toString({ timeZoneName: "never" }),
		};
	}
}
