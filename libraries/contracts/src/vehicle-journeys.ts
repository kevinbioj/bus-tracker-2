import { type } from "arktype";

import type { LinePath } from "./line-paths.js";
import { vehicleJourneyLineTypes } from "./vehicle-journey-attributes.js";

/** Canal Redis sur lequel les providers publient leurs courses, par lots. */
export const VEHICLE_JOURNEYS_CHANNEL = "journeys";

export const WITHDRAWN_JOURNEYS_CHANNEL = "journeys:withdrawn";

export const withdrawnJourneysSchema = type("string[]");

export const vehicleJourneyLineTypeEnum = type.enumerated(...vehicleJourneyLineTypes);

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

export const vehicleJourneyCallFlagsEnum = type("'NO_PICKUP'|'NO_DROP_OFF'|'PHONE_PICKUP'|'DRIVER_PICKUP'");
export type VehicleJourneyCallFlags = typeof vehicleJourneyCallFlagsEnum.infer;

export const callOnDemandEnum = type("'PHONE'|'DRIVER'");
export type CallOnDemand = typeof callOnDemandEnum.infer;

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
	// Arrêt provisoire : desserte ajoutée par une déviation, à un arrêt que la course ne dessert pas d'ordinaire.
	"temporary?": "boolean",
	"relocated?": "boolean",
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

export const vehicleJourneyOccupancyEnum = type.enumerated(...vehicleJourneyOccupancy);

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
	// Accessibilité de la course en fauteuil roulant (`wheelchair_accessible`). Absent : inconnue.
	"wheelchairAccessible?": "boolean",
	// Acceptation des vélos à bord (`bikes_allowed`). Absent : inconnue.
	"bikesAllowed?": "boolean",
	"serviceDate?": "string.date",
	updatedAt: "string.date.iso",
});

export type VehicleJourney = typeof vehicleJourneySchema.infer;
