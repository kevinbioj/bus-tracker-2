import { type } from "arktype";
import { z } from "zod";

export const vehicleJourneyLineTypes = [
	"TRAMWAY",
	"SUBWAY",
	"RAIL",
	"TROLLEY",
	"FUNICULAR",
	"BUS",
	"FERRY",
	"COACH",
	"UNKNOWN",
] as const;

export const vehicleJourneyLineTypeZodEnum = z.enum(vehicleJourneyLineTypes);

export const vehicleJourneyLineTypeEnum = type(
	"'TRAMWAY'|'SUBWAY'|'RAIL'|'TROLLEY'|'FUNICULAR'|'BUS'|'FERRY'|'COACH'|'UNKNOWN'",
);

export type VehicleJourneyLineType = typeof vehicleJourneyLineTypeEnum.infer;

export const vehicleJourneyLineSchema = type({
	ref: "string",
	number: "string",
	type: vehicleJourneyLineTypeEnum,
	"color?": "string",
	"textColor?": "string",
});
export type VehicleJourneyLine = typeof vehicleJourneyLineSchema.infer;

export const vehicleJourneyCallStatusEnum = type("'SCHEDULED'|'UNSCHEDULED'|'SKIPPED'");
export type VehicleJourneyCallStatus = typeof vehicleJourneyCallStatusEnum.infer;

export const vehicleJourneyCallFlagsEnum = type("'NO_PICKUP'|'NO_DROP_OFF'");
export type VehicleJourneyCallFlags = typeof vehicleJourneyCallFlagsEnum.infer;

export const vehicleJourneyCallSchema = type({
	aimedTime: "string.date.iso",
	"expectedTime?": "string.date.iso",
	stopRef: "string",
	stopName: "string",
	stopOrder: "number>=0",
	"platformName?": "string",
	"distanceTraveled?": "number",
	callStatus: vehicleJourneyCallStatusEnum,
	"flags?": vehicleJourneyCallFlagsEnum.array(),
});

export type VehicleJourneyCall = typeof vehicleJourneyCallSchema.infer;

export const vehicleJourneyPositionSchema = type({
	latitude: "number",
	longitude: "number",
	"bearing?": "number",
	atStop: "boolean",
	type: "'GPS'|'COMPUTED'",
	"distanceTraveled?": "number",
	recordedAt: "string.date.iso",
});

export type VehicleJourneyPosition = typeof vehicleJourneyPositionSchema.infer;

export const vehicleJourneyOccupancy = ["LOW", "MEDIUM", "HIGH", "NO_PASSENGERS"] as const;

export const vehicleJourneyOccupancyEnum = type("'LOW'|'MEDIUM'|'HIGH'|'NO_PASSENGERS'");

export const vehicleJourneyPathSchema = type({
	p: type(["number", "number", "number?"]).array(),
});

export type VehicleJourneyPath = typeof vehicleJourneyPathSchema.infer;

export const vehicleJourneySchema = type({
	id: "string",
	"line?": vehicleJourneyLineSchema,
	"direction?": "'OUTBOUND'|'INBOUND'",
	"destination?": "string",
	"calls?": vehicleJourneyCallSchema.array(),
	position: vehicleJourneyPositionSchema,
	"occupancy?": vehicleJourneyOccupancyEnum,
	"path?": vehicleJourneyPathSchema,
	"pathRef?": "string",
	networkRef: "string",
	"journeyRef?": "string",
	"operatorRef?": "string",
	"vehicleRef?": "string",
	"serviceDate?": "string.date",
	updatedAt: "string.date.iso",
});

export type VehicleJourney = typeof vehicleJourneySchema.infer;
