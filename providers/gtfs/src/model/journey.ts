import type { VehicleJourneyCallFlags, VehicleJourneyPosition } from "@bus-tracker/contracts";
import type { Temporal } from "temporal-polyfill";

import { getDirection } from "../utils/get-direction.js";

import type { StopTimeUpdate } from "./gtfs-rt.js";
import type { Stop } from "./stop.js";
import type { Trip } from "./trip.js";

export type JourneyCall = {
	aimedArrivalTime: Temporal.ZonedDateTime;
	expectedArrivalTime?: Temporal.ZonedDateTime;
	aimedDepartureTime: Temporal.ZonedDateTime;
	expectedDepartureTime?: Temporal.ZonedDateTime;
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

export class Journey {
	private bearing: number | undefined;

	constructor(
		readonly id: string,
		readonly trip: Trip,
		readonly date: Temporal.PlainDate,
		readonly calls: JourneyCall[],
	) {}

	guessPosition(at: Temporal.Instant): VehicleJourneyPosition {
		const calls = this.calls.filter((call) => call.status !== "SKIPPED");
		if (calls.length < 2) return this.getJourneyPositionAt(this.calls.at(0)!);

		// Cas n°1 - la course n'a pas encore commencé
		const firstCall = calls.at(0)!;
		if (at.epochMilliseconds < (firstCall.expectedDepartureTime ?? firstCall.aimedDepartureTime).epochMilliseconds) {
			return this.getJourneyPositionAt(firstCall);
		}

		// Cas n°2 - la course est terminée
		const lastCall = calls.at(-1)!;
		if (at.epochMilliseconds >= (lastCall.expectedArrivalTime ?? lastCall.aimedArrivalTime).epochMilliseconds) {
			return this.getJourneyPositionAt(lastCall);
		}

		// Cas n°3 - on est à l'arrêt
		const monitoredCall = calls.findLast(
			(call) => at.epochMilliseconds >= (call.expectedArrivalTime ?? call.aimedArrivalTime).epochMilliseconds,
		)!;

		if (
			at.epochMilliseconds < (monitoredCall.expectedDepartureTime ?? monitoredCall.aimedDepartureTime).epochMilliseconds
		) {
			return this.getJourneyPositionAt(monitoredCall);
		}

		// Autrement - on est en voyage
		const nextCall = calls.at(calls.indexOf(monitoredCall) + 1);
		if (
			typeof this.trip.shape === "undefined" ||
			typeof monitoredCall.distanceTraveled === "undefined" ||
			typeof nextCall?.distanceTraveled === "undefined"
		) {
			return this.getJourneyPositionAt(monitoredCall);
		}

		const leftAt = (monitoredCall.expectedDepartureTime ?? monitoredCall.aimedDepartureTime).epochMilliseconds;
		const arrivesAt = (nextCall.expectedArrivalTime ?? nextCall.aimedArrivalTime).epochMilliseconds;

		const percentTraveled = (at.epochMilliseconds - leftAt) / (arrivesAt - leftAt);
		const distanceTraveled =
			monitoredCall.distanceTraveled + (nextCall.distanceTraveled - monitoredCall.distanceTraveled) * percentTraveled;

		const currentShapePoint =
			this.trip.shape.points.findLast((point) => distanceTraveled >= point.distanceTraveled) ??
			this.trip.shape.points.at(0)!;
		const nextShapePoint =
			this.trip.shape.points.at(this.trip.shape.points.indexOf(currentShapePoint) + 1) ??
			this.trip.shape.points.at(-1)!;
		const ratio =
			(distanceTraveled - currentShapePoint.distanceTraveled) /
			(nextShapePoint.distanceTraveled - currentShapePoint.distanceTraveled);

		this.bearing = getDirection(
			currentShapePoint.longitude,
			currentShapePoint.latitude,
			nextShapePoint.longitude,
			nextShapePoint.latitude,
		);

		return {
			latitude: currentShapePoint.latitude + (nextShapePoint.latitude - currentShapePoint.latitude) * ratio,
			longitude: currentShapePoint.longitude + (nextShapePoint.longitude - currentShapePoint.longitude) * ratio,
			bearing: this.bearing,
			atStop: false,
			type: "COMPUTED",
			recordedAt: at.toZonedDateTimeISO(this.trip.route.agency.timeZone).toString({ timeZoneName: "never" }),
		};
	}

	hasRealtime() {
		return this.calls.some(
			(call) => typeof call.expectedArrivalTime !== "undefined" || typeof call.expectedDepartureTime !== "undefined",
		);
	}

	updateJourney(stopTimeUpdates: StopTimeUpdate[]) {
		let arrivalDelay: number | undefined;
		let departureDelay: number | undefined;

		const stopTimeUpdatesByStopId = Map.groupBy(stopTimeUpdates, (stopTimeUpdate) => stopTimeUpdate.stopId);
		const stopTimeUpdatesByStopSequence = Map.groupBy(stopTimeUpdates, (stopTimeUpdate) => stopTimeUpdate.stopSequence);

		for (const call of this.calls) {
			call.expectedArrivalTime = undefined;
			call.expectedDepartureTime = undefined;
			call.status = "SCHEDULED";

			let timeUpdate = (stopTimeUpdatesByStopSequence.get(call.sequence) ??
				stopTimeUpdatesByStopId.get(call.stop.id))?.[0];

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
				if (typeof arrivalDelay !== "undefined") {
					call.expectedArrivalTime = call.aimedArrivalTime.add({
						seconds: arrivalDelay,
					});
				}

				if (typeof departureDelay !== "undefined") {
					call.expectedDepartureTime = call.aimedArrivalTime.add({
						seconds: departureDelay,
					});
				}

				call.status = "SKIPPED";
				continue;
			}

			// Ce n'est pas un concept évident à comprendre pour certains producteurs que
			// de remplir ces champs avec les neuronnes qui communiquent correctement.
			const arrivalEvent = timeUpdate?.arrival ?? timeUpdate?.departure;
			const departureEvent = timeUpdate?.departure ?? timeUpdate?.arrival;

			if (typeof arrivalEvent?.time === "number") {
				arrivalDelay = arrivalEvent.time - Math.floor(call.aimedArrivalTime.epochMilliseconds / 1000);
			} else if (typeof arrivalEvent?.delay === "number") {
				arrivalDelay = arrivalEvent.delay;
			}

			if (typeof departureEvent?.time === "number") {
				departureDelay = departureEvent.time - Math.floor(call.aimedDepartureTime.epochMilliseconds / 1000);
			} else if (typeof departureEvent?.delay === "number") {
				departureDelay = departureEvent.delay;
			}

			if (typeof arrivalDelay !== "undefined") {
				call.expectedArrivalTime = call.aimedArrivalTime.add({
					seconds: arrivalDelay,
				});
			}

			if (typeof departureDelay !== "undefined") {
				call.expectedDepartureTime = call.aimedDepartureTime.add({
					seconds: departureDelay,
				});
			}
		}
	}

	private getJourneyPositionAt(call: JourneyCall): VehicleJourneyPosition {
		return {
			latitude: call.stop.latitude,
			longitude: call.stop.longitude,
			bearing: this.bearing,
			atStop: true,
			type: "COMPUTED",
			recordedAt: (call.expectedArrivalTime ?? call.aimedArrivalTime).toString({
				timeZoneName: "never",
			}),
		};
	}
}
