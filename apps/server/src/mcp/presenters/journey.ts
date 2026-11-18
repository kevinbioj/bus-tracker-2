import { getVehicleJourneyPositionType, vehicleJourneyPositionTypes } from "@bus-tracker/contracts";
import * as z from "zod";

import type { DisposeableVehicleJourney } from "../../types/disposeable-vehicle-journey.js";
import { minutesBetween, toLocalTime } from "./time.js";

export const callSchema = z.object({
	stop: z.string(),
	stopRef: z.string(),
	platform: z.string().optional(),
	scheduled: z.string(),
	expected: z.string().optional(),
	status: z.enum(["SCHEDULED", "UNSCHEDULED", "SKIPPED"]),
	temporary: z.boolean().optional(),
	relocated: z.boolean().optional(),
});

export const journeySchema = z.object({
	journeyId: z.string(),
	line: z.string().optional(),
	lineId: z.number().optional(),
	networkId: z.number(),
	destination: z.string().optional(),
	direction: z.enum(["OUTBOUND", "INBOUND"]).optional(),
	vehicleNumber: z.string().optional(),
	vehicleId: z.number().optional(),
	positionType: z.enum(vehicleJourneyPositionTypes),
	atStop: z.boolean(),
	delayMinutes: z.number().optional(),
	disrupted: z.boolean(),
	occupancy: z.enum(["LOW", "MEDIUM", "HIGH", "NO_PASSENGERS"]).optional(),
	wheelchairAccessible: z.boolean().optional(),
	position: z.object({ latitude: z.number(), longitude: z.number() }),
	positionRecordedAt: z.string(),
	calls: z.array(callSchema),
});

export type PresentedJourney = z.input<typeof journeySchema>;

function delayMinutesOf(journey: DisposeableVehicleJourney) {
	const call = journey.calls?.find((candidate) => candidate.callStatus !== "SKIPPED");
	if (call?.expectedTime === undefined) return undefined;
	return minutesBetween(call.aimedTime, call.expectedTime);
}

const isDisrupted = (journey: DisposeableVehicleJourney) =>
	journey.calls?.some(
		(call) => call.callStatus !== "SCHEDULED" || call.temporary === true || call.relocated === true,
	) ?? false;

export function presentJourney(
	journey: DisposeableVehicleJourney,
	{ timezone, lineNumber, callCount }: { timezone: string; lineNumber?: string; callCount: number },
): PresentedJourney {
	return {
		journeyId: journey.id,
		line: lineNumber,
		lineId: journey.lineId,
		networkId: journey.networkId,
		destination: journey.destination,
		direction: journey.direction,
		vehicleNumber: journey.vehicle?.number,
		vehicleId: journey.vehicle?.id,
		positionType: getVehicleJourneyPositionType(journey),
		atStop: journey.position.atStop,
		delayMinutes: delayMinutesOf(journey),
		disrupted: isDisrupted(journey),
		occupancy: journey.occupancy,
		wheelchairAccessible: journey.wheelchairAccessible,
		position: { latitude: journey.position.latitude, longitude: journey.position.longitude },
		positionRecordedAt: toLocalTime(journey.position.recordedAt, timezone),
		calls: (journey.calls ?? []).slice(0, callCount).map((call) => ({
			stop: call.stopName,
			stopRef: call.stopRef,
			platform: call.platformName,
			scheduled: toLocalTime(call.aimedTime, timezone),
			expected: call.expectedTime !== undefined ? toLocalTime(call.expectedTime, timezone) : undefined,
			status: call.callStatus,
			temporary: call.temporary,
			relocated: call.relocated,
		})),
	};
}
