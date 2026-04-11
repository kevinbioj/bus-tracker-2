import type { VehicleJourneyCallFlags, VehicleJourneyPosition } from "@bus-tracker/contracts";

import { getDirection } from "../utils/get-direction.js";
import { groupBy } from "../utils/group-by.js";

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

export class Journey {
	private bearing: number | undefined;
	private _vehicleDescriptor: VehicleDescriptor | undefined;
	private _vehicleDescriptorUpdatedAt: number | undefined;
	private _calls: JourneyCall[] | null = null;
	private _hasRealtime = false;

	constructor(
		readonly id: string,
		readonly trip: Trip,
		readonly date: Temporal.PlainDate,
		/** Heure d'arrivée visée au premier arrêt (epoch ms). Précalculé pour éviter de matérialiser calls[]. */
		readonly firstCallArrivalMs: number,
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
	 * Libère le cache des calls si le voyage est terminé et n'a pas de données temps réel.
	 * À appeler après chaque cycle de calcul. Les voyages encore actifs ou futurs conservent
	 * leur cache pour éviter de re-calculer computeCallsForDate() à chaque cycle.
	 */
	releaseUnmodifiedCalls(nowMs: number) {
		if (!this._hasRealtime && nowMs > this.lastCallDepartureMs) {
			this._calls = null;
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

		// Borner l'heure d'arrivée à nextCall par la plus petite heure connue parmi les arrêts suivants.
		// Si un arrêt ultérieur a un temps réel antérieur à l'heure théorique de nextCall,
		// le bus y sera forcément avant ce temps — sans cette borne, le ratio serait sous-estimé.
		let arrivalMs = nextCall.expectedArrivalTime ?? nextCall.aimedArrivalTime;
		for (let i = currentCallIndex + 2; i < calls.length; i++) {
			const t = calls[i]!.expectedArrivalTime ?? calls[i]!.aimedArrivalTime;
			if (t < arrivalMs) arrivalMs = t;
		}
		const ratio = Math.max(0, Math.min(1, (atMs - departureMs) / (arrivalMs - departureMs)));
		const distanceTraveled =
			currentCall.distanceTraveled + (nextCall.distanceTraveled - currentCall.distanceTraveled) * ratio;

		const pointIndex = this.trip.shape.findPointIndex(distanceTraveled);
		if (pointIndex === undefined) {
			return this.getJourneyPositionAt(currentCall);
		}

		const nextPointIndex = Math.min(pointIndex + 1, this.trip.shape.length - 1);

		const currentLat = this.trip.shape.getPointLatitude(pointIndex);
		const currentLon = this.trip.shape.getPointLongitude(pointIndex);
		const currentDist = this.trip.shape.getPointDistanceTraveled(pointIndex)!;

		const nextLat = this.trip.shape.getPointLatitude(nextPointIndex);
		const nextLon = this.trip.shape.getPointLongitude(nextPointIndex);
		const nextDist = this.trip.shape.getPointDistanceTraveled(nextPointIndex)!;

		const pointRatio = nextDist === currentDist ? 0 : (distanceTraveled - currentDist) / (nextDist - currentDist);

		const latitude = currentLat + (nextLat - currentLat) * pointRatio;
		const longitude = currentLon + (nextLon - currentLon) * pointRatio;
		this.bearing = getDirection(currentLon, currentLat, nextLon, nextLat);

		return {
			latitude,
			longitude,
			bearing: this.bearing,
			atStop: false,
			type: "COMPUTED",
			distanceTraveled,
			recordedAt: at.toZonedDateTimeISO(this.trip.route.agency.timeZone).toString({ timeZoneName: "never" }),
		};
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

	updateJourney(stopTimeUpdates: StopTimeUpdate[], appendTripUpdateInformation?: boolean) {
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
				call.status = "SCHEDULED";
			}

			let timeUpdate = stopTimeUpdatesByStopSequence[call.sequence] ?? stopTimeUpdatesByStopId?.[call.stop.id];

			// Prevent wrong time assignation on circular lines when all stop events aren't provided
			if (typeof timeUpdate?.stopSequence === "number" && timeUpdate.stopSequence !== call.sequence) {
				timeUpdate = undefined;
			}

			call.platform = timeUpdate?.stopTimeProperties?.assignedStopId;

			if (timeUpdate?.scheduleRelationship === "NO_DATA") {
				arrivalDelay = undefined;
				departureDelay = undefined;
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
		}

		// Mise à jour du flag RT basée sur l'état réel des calls.
		this._hasRealtime = this._calls!.some(
			(call) => call.expectedArrivalTime !== undefined || call.expectedDepartureTime !== undefined,
		);

		// Mettre à jour lastCallDepartureMs avec l'heure temps réel du dernier arrêt.
		// Utilisé par le sweep et le fast-rejection de getCalls.
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
