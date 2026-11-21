import { z } from "zod";

import type { CallOnDemand, VehicleJourneyCallFlags, VehicleJourneyCallStatus } from "./vehicle-journeys.js";

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

export function getCallOnDemand(flags: readonly VehicleJourneyCallFlags[] | undefined): CallOnDemand | undefined {
	if (flags?.includes("PHONE_PICKUP")) return "PHONE";
	if (flags?.includes("DRIVER_PICKUP")) return "DRIVER";
	return undefined;
}

export const vehicleJourneyPositionTypes = ["GPS", "ESTIMATED", "SCHEDULED"] as const;

export type VehicleJourneyPositionType = (typeof vehicleJourneyPositionTypes)[number];

/**
 * Nature de la position publiée, telle qu'elle est présentée à l'usager et filtrée par l'API :
 * relevée par le véhicule, déduite d'un horaire temps réel, ou déduite du seul horaire théorique.
 *
 * Un arrêt ajouté par une déviation (`UNSCHEDULED`) n'a d'heure attendue que celle qu'il reprend de
 * son arrêt de référence : il n'est pas une prédiction à lui seul, et une course théorique déviée
 * reste théorique. Seule une course supplémentaire échappe à la règle — dépourvue d'horaire
 * théorique, toutes ses heures sont du temps réel, et tous ses arrêts sont `UNSCHEDULED`.
 */
export function getVehicleJourneyPositionType(journey: {
	calls?: { expectedTime?: string; callStatus: VehicleJourneyCallStatus }[];
	position: { type: "GPS" | "COMPUTED" };
	isAdded?: boolean;
}): VehicleJourneyPositionType {
	if (journey.position.type === "GPS") return "GPS";
	if (journey.isAdded === true) return "ESTIMATED";

	return journey.calls?.some((call) => call.callStatus !== "UNSCHEDULED" && call.expectedTime !== undefined)
		? "ESTIMATED"
		: "SCHEDULED";
}
