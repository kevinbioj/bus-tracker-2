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
	constructor(
		readonly id: string,
		readonly trip: Trip,
		readonly date: Temporal.PlainDate,
		readonly calls: JourneyCall[],
	) {}

	guessPosition(at: Temporal.Instant): VehicleJourneyPosition {
		const nextCall = this.calls.find(
			(call) => at.epochSeconds < (call.expectedArrivalTime ?? call.aimedArrivalTime).epochSeconds,
		);
		if (typeof nextCall === "undefined") {
			// Le véhicule se situe à l'arrêt d'arrivée.
			const lastCall = this.calls.at(-1)!;
			return Journey.getJourneyPositionAt(lastCall);
		}

		const nextCallIndex = this.calls.indexOf(nextCall);
		const monitoredCall = nextCallIndex === 0 ? nextCall : this.calls.at(nextCallIndex - 1)!;
		const monitoredCallDistanceTraveled = this.trip.stopTimes.find(
			(stopTime) => stopTime.sequence === monitoredCall.sequence,
		)!.distanceTraveled;
		const nextCallDistanceTraveled = this.trip.stopTimes.find(
			(stopTime) => stopTime.sequence === nextCall.sequence,
		)!.distanceTraveled;
		if (
			monitoredCall === nextCall ||
			typeof this.trip.shape === "undefined" ||
			typeof monitoredCallDistanceTraveled === "undefined" ||
			typeof nextCallDistanceTraveled === "undefined"
		) {
			// Le véhicule se situe à l'arrêt de départ ou il n'y a pas de tracé pour ce trajet.
			return Journey.getJourneyPositionAt(monitoredCall);
		}

		const lastDepartureTime = (monitoredCall.expectedDepartureTime ?? monitoredCall.aimedDepartureTime).epochSeconds;
		const nextArrivalTime = (nextCall.expectedArrivalTime ?? nextCall.aimedArrivalTime).epochSeconds;
		const inBetweenTime = nextArrivalTime - lastDepartureTime;
		const percentTraveled = (at.epochSeconds - lastDepartureTime) / inBetweenTime;
		const estimatedDistanceTraveled =
			monitoredCallDistanceTraveled + (nextCallDistanceTraveled - monitoredCallDistanceTraveled) * percentTraveled;

		const currentShapePoint =
			this.trip.shape.points.findLast((point) => estimatedDistanceTraveled >= point.distanceTraveled) ??
			this.trip.shape.points.at(-1)!;
		const nextShapePoint =
			this.trip.shape.points.at(this.trip.shape.points.indexOf(currentShapePoint) + 1) ??
			this.trip.shape.points.at(-1)!;
		const ratio =
			(estimatedDistanceTraveled - currentShapePoint.distanceTraveled) /
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
		return this.calls.some((call) => !!(call.expectedArrivalTime ?? call.expectedDepartureTime));
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
				call.expectedArrivalTime = call.aimedArrivalTime.add({
					seconds: arrivalDelay ?? 0,
				});
				call.expectedDepartureTime = call.aimedArrivalTime.add({
					seconds: departureDelay ?? 0,
				});
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

			call.expectedArrivalTime = call.aimedArrivalTime.add({
				seconds: arrivalDelay ?? 0,
			});
			call.expectedDepartureTime = call.aimedDepartureTime.add({
				seconds: departureDelay ?? 0,
			});
		}
	}

	// ---

	private static getJourneyPositionAt(call: JourneyCall): VehicleJourneyPosition {
		return {
			latitude: call.stop.latitude,
			longitude: call.stop.longitude,
			atStop: true,
			type: "COMPUTED",
			recordedAt: (call.expectedArrivalTime ?? call.aimedArrivalTime).toString({ timeZoneName: "never" }),
		};
	}
}
