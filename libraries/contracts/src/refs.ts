/**
 * Grammaire des références publiées. Les providers les fabriquent, le serveur et le client les
 * relisent : toutes passent par ici, pour qu'un changement de forme ne laisse aucun lecteur derrière.
 *
 * Une référence d'entité est de la forme `${networkRef}:${kind}:${localId}` — le réseau en préfixe,
 * l'identifiant propre au producteur en suffixe.
 */
export type RefKind = "Line" | "StopPoint" | "StopArea" | "ServiceJourney";

const infixOf = (kind: RefKind | "Vehicle") => `:${kind}:`;

export const toLineRef = (networkRef: string, lineId: string) => `${networkRef}:Line:${lineId}`;
export const toStopPointRef = (networkRef: string, stopId: string) => `${networkRef}:StopPoint:${stopId}`;
export const toStopAreaRef = (networkRef: string, areaId: string) => `${networkRef}:StopArea:${areaId}`;
export const toServiceJourneyRef = (networkRef: string, tripId: string) => `${networkRef}:ServiceJourney:${tripId}`;
export const toVehicleRef = (networkRef: string, operatorRef: string | undefined, number: string) =>
	`${networkRef}:${operatorRef ?? ""}:Vehicle:${number}`;

/** Identifiant local d'une référence du genre donné, `undefined` si elle est d'un autre genre. */
export function localIdOf(ref: string, kind: RefKind) {
	const infix = infixOf(kind);
	const index = ref.indexOf(infix);
	return index === -1 ? undefined : ref.slice(index + infix.length);
}

export const isRefOf = (ref: string, kind: RefKind) => ref.includes(infixOf(kind));

/** Numéro d'un véhicule tel que sa référence le porte ; une référence d'une autre forme est rendue telle quelle. */
export function vehicleNumberOf(vehicleRef: string) {
	const infix = infixOf("Vehicle");
	const index = vehicleRef.indexOf(infix);
	return index === -1 ? vehicleRef : vehicleRef.slice(index + infix.length);
}

/**
 * Identifiants de course publiés : une course est suivie sous la clé de son véhicule, à défaut sous
 * celle de son roulement ou de sa course théorique, datées de leur jour de service.
 */
export const toVehicleTrackingId = (networkRef: string, operatorRef: string | undefined, vehicleId: string) =>
	`${networkRef}:${operatorRef ?? ""}:VehicleTracking:${vehicleId}`;
export const toServiceBlockId = (
	networkRef: string,
	operatorRef: string | undefined,
	blockId: string,
	serviceDate: string,
) => `${networkRef}:${operatorRef ?? ""}:ServiceBlock:${blockId}:${serviceDate}`;
export const toServiceJourneyId = (
	networkRef: string,
	operatorRef: string | undefined,
	tripId: string,
	serviceDate: string,
) => `${networkRef}:${operatorRef ?? ""}:ServiceJourney:${tripId}:${serviceDate}`;

/** Les barres obliques n'ont pas leur place dans un chemin d'URL : elles sont remplacées à la publication. */
export const toPublishedJourneyId = (journeyId: string) => journeyId.replaceAll("/", "_");

/** Clés Redis des tracés : celui d'une ligne, celui que suit une course, celui qu'abandonne une course déviée. */
export const toLinePathRef = (lineRef: string) => `${lineRef}:LinePath`;
export const toRoutePathRef = (networkRef: string, sourceId: string, shapeId: string) =>
	`${networkRef}:RoutePath:${sourceId}:${shapeId}`;
export const toCancelledPathRef = (networkRef: string, sourceId: string, tripId: string, serviceDate: string) =>
	`${networkRef}:CancelledPath:${sourceId}:${tripId}:${serviceDate}`;

export const isPathRef = (ref: string) =>
	ref.includes(":RoutePath:") || ref.includes(":CancelledPath:") || ref.endsWith(":LinePath");
