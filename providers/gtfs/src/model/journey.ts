import type { Temporal } from "temporal-polyfill";

import type { VehicleJourneyPosition } from "@bus-tracker/contracts";
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
	distanceTraveled?: number;
	status: "SCHEDULED" | "SKIPPED";
};

export type JourneyPosition = {
	latitude: number;
	longitude: number;
	atStop: boolean;
	type: "GPS" | "COMPUTED";
	recordedAt: Temporal.Instant;
};

export class Journey {
	#currentShapeIndex = -1;

	constructor(
		readonly id: string,
		readonly trip: Trip,
		readonly date: Temporal.PlainDate,
		readonly calls: JourneyCall[],
	) {}

	guessPosition(at: Temporal.Instant): VehicleJourneyPosition {
		const calls = this.calls.filter((call) => call.status !== "SKIPPED");
		if (calls.length < 2) throw new Error(`Journey '${this.id}' has less than 2 scheduled calls`);

		// Cas n°1 - la course n'a pas encore commencé
		const firstCall = calls.at(0)!;
		if (at.epochSeconds < (firstCall.expectedDepartureTime ?? firstCall.aimedDepartureTime).epochSeconds) {
			return Journey.getJourneyPositionAt(firstCall);
		}

		// Cas n°2 - la course est terminée
		const lastCall = calls.at(-1)!;
		if (at.epochSeconds >= (lastCall.expectedArrivalTime ?? lastCall.aimedArrivalTime).epochSeconds) {
			return Journey.getJourneyPositionAt(lastCall);
		}

		// Cas n°3 - on est à l'arrêt
		const monitoredCall = calls.find(
			(call) => at.epochSeconds >= (call.expectedArrivalTime ?? call.aimedArrivalTime).epochSeconds,
		)!;
		if (at.epochSeconds < (monitoredCall.expectedDepartureTime ?? monitoredCall.aimedDepartureTime).epochSeconds) {
			return Journey.getJourneyPositionAt(monitoredCall);
		}

		// Autrement - on est en voyage
		const nextCall = calls.at(calls.indexOf(monitoredCall) + 1);
		if (
			typeof this.trip.shape === "undefined" ||
			typeof monitoredCall.distanceTraveled === "undefined" ||
			typeof nextCall?.distanceTraveled === "undefined"
		) {
			return Journey.getJourneyPositionAt(monitoredCall);
		}

		const leftAt = (monitoredCall.expectedDepartureTime ?? monitoredCall.aimedDepartureTime).epochSeconds;
		const arrivesAt = (nextCall.expectedArrivalTime ?? nextCall.aimedArrivalTime).epochSeconds;

		const percentTraveled = (at.epochSeconds - leftAt) / (arrivesAt - leftAt);
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

		return {
			latitude: currentShapePoint.latitude + (nextShapePoint.latitude - currentShapePoint.latitude) * ratio,
			longitude: currentShapePoint.longitude + (nextShapePoint.longitude - currentShapePoint.longitude) * ratio,
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

		for (const call of this.calls) {
			const timeUpdate = stopTimeUpdates?.find(
				(stu) => stu.stopSequence === call.sequence || stu.stopId === call.stop.id,
			);

			if (timeUpdate?.scheduleRelationship === "NO_DATA") {
				arrivalDelay = undefined;
				departureDelay = undefined;
				call.expectedArrivalTime = undefined;
				call.expectedDepartureTime = undefined;
				call.status = "SCHEDULED";
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
				arrivalDelay = arrivalEvent.time - call.aimedArrivalTime.epochSeconds;
			} else if (typeof arrivalEvent?.delay === "number") {
				arrivalDelay = arrivalEvent.delay;
			}

			if (typeof departureEvent?.time === "number") {
				departureDelay = departureEvent.time - call.aimedDepartureTime.epochSeconds;
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

	// ---

	private static getJourneyPositionAt(call: JourneyCall): VehicleJourneyPosition {
		return {
			latitude: call.stop.latitude,
			longitude: call.stop.longitude,
			atStop: true,
			type: "COMPUTED",
			recordedAt: (call.expectedArrivalTime ?? call.aimedArrivalTime).toString({
				timeZoneName: "never",
			}),
		};
	}
}
