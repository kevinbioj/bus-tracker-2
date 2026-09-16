import { type } from "arktype";
import { z } from "zod";

import type { LinePath } from "./line-paths.js";

export const vehicleJourneyLineTypes = [
	"TRAMWAY",
	"SUBWAY",
	"RAIL",
	"TROLLEY",
	"FUNICULAR",
	"GONDOLA",
	"BUS",
	"FERRY",
	"COACH",
	"UNKNOWN",
] as const;

export const vehicleJourneyLineTypeZodEnum = z.enum(vehicleJourneyLineTypes);

export const vehicleJourneyLineTypeEnum = type(
	"'TRAMWAY'|'SUBWAY'|'RAIL'|'TROLLEY'|'FUNICULAR'|'GONDOLA'|'BUS'|'FERRY'|'COACH'|'UNKNOWN'",
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
	// Heure de départ de l'arrêt — ou heure d'arrivée au terminus, qui n'a pas de départ.
	aimedTime: "string.date.iso",
	"expectedTime?": "string.date.iso",
	// Heure d'arrivée, renseignée uniquement lorsqu'elle diffère du départ (temps de stationnement).
	"aimedArrivalTime?": "string.date.iso",
	"expectedArrivalTime?": "string.date.iso",
	stopRef: "string",
	stopName: "string",
	stopOrder: "number>=0",
	"platformName?": "string",
	"distanceTraveled?": "number",
	"latitude?": "number",
	"longitude?": "number",
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

/**
 * Tracés d'une course, servis ensemble : celui qu'elle suit, et les portions du tracé théorique que
 * sa déviation lui fait abandonner — ces dernières n'ayant aucun sens sans le premier.
 */
export type VehicleJourneyPaths = {
	path: VehicleJourneyPath;
	/** Absent lorsque la course n'est pas déviée, ou que sa déviation n'abandonne aucune portion. */
	cancelled?: LinePath;
};

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
	// Portions du tracé théorique que la course, déviée, n'emprunte plus. Référence un `LinePath`.
	// Détail de transport : le client obtient les deux tracés d'un coup par
	// `/vehicle-journeys/:id/paths`, et cette référence ne lui est pas exposée.
	"cancelledPathRef?": "string",
	networkRef: "string",
	"journeyRef?": "string",
	"operatorRef?": "string",
	"vehicleRef?": "string",
	"hasRealVehicle?": "boolean",
	// Course absente du GTFS statique, reconstituée depuis un TripUpdate : ses arrêts n'ont aucun
	// horaire théorique auquel opposer le temps réel, ni avance ni retard à en déduire.
	"isAdded?": "boolean",
	// Code mission (Transilien notamment), affiché en lieu et place du numéro de véhicule.
	"missionCode?": "string",
	"serviceDate?": "string.date",
	updatedAt: "string.date.iso",
});

export type VehicleJourney = typeof vehicleJourneySchema.infer;
