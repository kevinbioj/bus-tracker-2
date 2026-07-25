import type { VehicleJourneyCallFlags, VehicleJourneyPosition } from "@bus-tracker/contracts";

import { groupBy } from "../utils/group-by.js";
import type { Gtfs } from "./gtfs.js";
import type { StopTimeUpdate, VehicleDescriptor } from "./gtfs-rt.js";
import type { Stop } from "./stop.js";
import type { Trip } from "./trip.js";

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
	flags: VehicleJourneyCallFlags[];
};

export type JourneyPosition = {
	latitude: number;
	longitude: number;
	atStop: boolean;
	type: "GPS" | "COMPUTED";
	recordedAt: Temporal.Instant;
};

const VEHICLE_DESCRIPTOR_TTL_MS = 5 * 60 * 1000;

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

	constructor(
		readonly id: string,
		readonly trip: Trip,
		readonly date: Temporal.PlainDate,
		/** Heure d'arrivée au premier arrêt (epoch ms). Initialisé sur l'heure théorique, mis à jour par updateJourney avec l'heure temps réel. */
		public firstCallArrivalMs: number,
		/** Heure de départ au dernier arrêt (epoch ms). Initialisé sur l'heure théorique, mis à jour par updateJourney avec l'heure temps réel. */
		public lastCallDepartureMs: number,
	) {}

	/**
	 * Tableau des appels de la journée. Calculé à la demande (lazy) et mis en cache.
	 * Utilisé uniquement quand le voyage est dans la fenêtre active ou a des données temps réel.
	 */
	get calls(): JourneyCall[] {
		if (this._calls === null) {
			this._calls = this.trip.computeCallsForDate(this.date);
		}
		return this._calls;
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

		if (
			this.trip.shape === undefined ||
			currentCall.distanceTraveled === undefined ||
			nextCall?.distanceTraveled === undefined
		) {
			return this.getJourneyPositionAt(currentCall);
		}

		const arrivalMs = getBoundedArrivalMs(calls, currentCallIndex + 1);
		const ratio = Math.max(0, Math.min(1, (atMs - departureMs) / (arrivalMs - departureMs)));
		const distanceTraveled =
			currentCall.distanceTraveled + (nextCall.distanceTraveled - currentCall.distanceTraveled) * ratio;

		const point = this.trip.shape.interpolateAt(distanceTraveled);
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
			recordedAt: at.toZonedDateTimeISO(this.trip.route.agency.timeZone).toString({ timeZoneName: "never" }),
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

	updateJourney(gtfs: Gtfs, stopTimeUpdates: StopTimeUpdate[], appendTripUpdateInformation?: boolean) {
		let arrivalDelay: number | undefined;
		let departureDelay: number | undefined;

		const stopTimeUpdatesByStopSequence = groupBy(stopTimeUpdates, (stopTimeUpdate) => stopTimeUpdate.stopSequence);
		const stopTimeUpdatesByStopId =
			Object.keys(stopTimeUpdatesByStopSequence).length > 0
				? undefined
				: groupBy(stopTimeUpdates, (stopTimeUpdate) => stopTimeUpdate.stopId);

		for (const call of this.calls) {
			if (!appendTripUpdateInformation) {
				call.expectedArrivalTime = undefined;
				call.expectedDepartureTime = undefined;
				call.platform = call.stop.platformCode;
				call.status = "SCHEDULED";
			}

			let timeUpdate = stopTimeUpdatesByStopSequence[call.sequence] ?? stopTimeUpdatesByStopId?.[call.stop.id];

			// Prevent wrong time assignation on circular lines when all stop events aren't provided
			if (typeof timeUpdate?.stopSequence === "number" && timeUpdate.stopSequence !== call.sequence) {
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
				call.status = "SCHEDULED";
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

			call.status = "SCHEDULED";
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
				.toZonedDateTimeISO(this.trip.route.agency.timeZone)
				.toString({ timeZoneName: "never" }),
		};
	}
}
