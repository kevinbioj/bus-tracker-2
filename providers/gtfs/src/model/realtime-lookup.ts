import { createShapeFromPolyline } from "../utils/decode-polyline.js";

import type { Gtfs } from "./gtfs.js";
import type { RtShape, RtStop, TranslatedString } from "./gtfs-rt.js";
import type { Shape } from "./shape.js";
import { Stop } from "./stop.js";

/**
 * Ressources déclarées par le flux temps réel lui-même : arrêts de déviation et tracés de
 * remplacement, qui n'existent dans aucun fichier du GTFS statique.
 */
export type RealtimeResources = {
	shapes: Map<string, Shape>;
	stops: Map<string, Stop>;
};

export function createRealtimeResources(): RealtimeResources {
	return { shapes: new Map(), stops: new Map() };
}

/** Première traduction disponible : le flux n'a pas de langue de référence à opposer à l'utilisateur. */
function getTranslation(translatedString?: TranslatedString) {
	const text = translatedString?.translation?.[0]?.text;
	return text !== undefined && text.length > 0 ? text : undefined;
}

/**
 * Projette un arrêt publié par le flux temps réel sur le modèle interne.
 * @returns undefined si le nom ou la position manquent — la spec les rend obligatoires.
 */
export function createStopFromRtStop(rtStop: RtStop): Stop | undefined {
	const name = getTranslation(rtStop.stopName);
	if (rtStop.stopId === undefined || name === undefined) return;
	if (typeof rtStop.stopLat !== "number" || typeof rtStop.stopLon !== "number") return;

	return new Stop(
		rtStop.stopId,
		name,
		rtStop.stopLat,
		rtStop.stopLon,
		getTranslation(rtStop.platformCode),
		rtStop.stopTimezone,
	);
}

export function createShapeFromRtShape(rtShape: RtShape): Shape | undefined {
	if (rtShape.shapeId === undefined || rtShape.encodedPolyline === undefined) return;
	return createShapeFromPolyline(rtShape.shapeId, rtShape.encodedPolyline);
}

/**
 * Résout un tracé désigné par un flux temps réel. La spec autorise un `shape_id` à désigner
 * indifféremment un tracé publié dans le flux ou un tracé de `shapes.txt` ; le flux prime, ses
 * identifiants devant de toute façon être distincts de ceux du GTFS statique.
 */
export function resolveShape(gtfs: Gtfs, resources: RealtimeResources, shapeId?: string) {
	if (shapeId === undefined) return;
	return resources.shapes.get(shapeId) ?? gtfs.shapes.get(shapeId);
}

/** Idem pour un arrêt : `stops.txt` prime, le flux ne fournissant que les arrêts qui y manquent. */
export function resolveStop(gtfs: Gtfs, resources: RealtimeResources, stopId?: string) {
	if (stopId === undefined) return;
	return gtfs.stops.get(stopId) ?? resources.stops.get(stopId);
}
