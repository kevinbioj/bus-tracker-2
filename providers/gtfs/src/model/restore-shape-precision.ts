import { getDistance } from "../utils/get-distance.js";

import { Shape } from "./shape.js";

/**
 * Écart maximal, en mètres, entre un point du tracé dégradé et le tracé de référence pour qu'il
 * soit considéré comme le même itinéraire. L'arrondi à 1e-5 déplace un point d'au plus ~0,7 m ;
 * deux rues distinctes sont, elles, séparées de bien davantage.
 */
const MATCH_TOLERANCE_M = 2;

/**
 * Deux points consécutifs projetés sur la référence ne sont reliés par elle que si le détour
 * qu'elle impose reste proche du trait qui les joint : au-delà, la référence fait une boucle que le
 * tracé dégradé ne parcourt pas.
 */
const MAX_DETOUR_RATIO = 1.5;
const MAX_DETOUR_SLACK_M = 20;

type Projection = {
	/** Indice du segment de référence [segment, segment + 1] qui porte la projection. */
	segment: number;
	/** Position sur ce segment, de 0 à 1. */
	t: number;
	latitude: number;
	longitude: number;
};

const cache = new WeakMap<Shape, WeakMap<Shape, Shape>>();

/**
 * Rend sa précision à un tracé publié en polyligne encodée, dont les coordonnées sont arrondies à
 * 1e-5 (~1 m) : là où il suit le tracé de référence, ses points sont remplacés par les sommets de
 * celui-ci, à pleine précision. Seules les portions qui s'en écartent — la déviation elle-même —
 * gardent les points publiés, faute de mieux.
 *
 * Sans cela, les points rapprochés d'un tracé arrondi tombent sur les mêmes latitudes ou longitudes,
 * et le tracé se dessine en marches d'escalier.
 */
export function restoreShapePrecision(degradedShape: Shape, referenceShape: Shape) {
	let byReference = cache.get(degradedShape);
	if (byReference === undefined) {
		byReference = new WeakMap();
		cache.set(degradedShape, byReference);
	}

	let restored = byReference.get(referenceShape);
	if (restored === undefined) {
		restored = computeRestoredShape(degradedShape, referenceShape);
		byReference.set(referenceShape, restored);
	}

	return restored;
}

function computeRestoredShape(degradedShape: Shape, referenceShape: Shape) {
	if (degradedShape.length < 2 || referenceShape.length < 2) return degradedShape;

	// Distances cumulées recalculées : celles de `shape_dist_traveled` ne sont pas forcément en mètres.
	const referenceDistances = new Float64Array(referenceShape.length);
	for (let i = 1; i < referenceShape.length; i++) {
		referenceDistances[i] =
			referenceDistances[i - 1]! +
			getDistance(
				referenceShape.getPointLatitude(i - 1),
				referenceShape.getPointLongitude(i - 1),
				referenceShape.getPointLatitude(i),
				referenceShape.getPointLongitude(i),
			);
	}

	const alongReference = ({ segment, t }: Projection) =>
		referenceDistances[segment]! + t * (referenceDistances[segment + 1]! - referenceDistances[segment]!);

	const points: [number, number][] = [];
	const push = (latitude: number, longitude: number) => {
		const last = points.at(-1);
		if (last !== undefined && last[0] === latitude && last[1] === longitude) return;
		points.push([latitude, longitude]);
	};

	const count = degradedShape.length;
	const projections: (Projection | undefined)[] = new Array(count);
	/** Dernière projection obtenue : la recherche ne remonte pas en deçà, même après une déviation. */
	let lastProjection: Projection | undefined;
	for (let i = 0; i < count; i++) {
		projections[i] = projectOnReference(
			referenceShape,
			degradedShape.getPointLatitude(i),
			degradedShape.getPointLongitude(i),
			lastProjection,
		);
		lastProjection = projections[i] ?? lastProjection;
	}

	// Le segment qui relie deux points consécutifs suit la référence : tous deux s'y projettent, et
	// elle ne fait pas entre eux de boucle que le tracé dégradé ne parcourt pas.
	const linkedToPrevious = (i: number) => {
		if (i === 0 || i >= count) return false;
		const previous = projections[i - 1];
		const current = projections[i];
		if (previous === undefined || current === undefined) return false;

		const chord = getDistance(
			degradedShape.getPointLatitude(i - 1),
			degradedShape.getPointLongitude(i - 1),
			degradedShape.getPointLatitude(i),
			degradedShape.getPointLongitude(i),
		);
		return alongReference(current) - alongReference(previous) <= chord * MAX_DETOUR_RATIO + MAX_DETOUR_SLACK_M;
	};

	let matchedCount = 0;
	for (let i = 0; i < count; i++) {
		const projection = projections[i];
		if (projection === undefined) {
			push(degradedShape.getPointLatitude(i), degradedShape.getPointLongitude(i));
			continue;
		}

		matchedCount += 1;

		const linked = linkedToPrevious(i);
		if (linked) {
			const previous = projections[i - 1]!;
			for (let vertex = previous.segment + 1; vertex <= projection.segment; vertex++) {
				push(referenceShape.getPointLatitude(vertex), referenceShape.getPointLongitude(vertex));
			}
		}

		// Au sein d'une portion qui suit la référence, seuls ses sommets comptent : les points publiés,
		// arrondis, n'en sont que des approximations. Leur projection ne marque que les jonctions avec
		// les portions déviées.
		if (!linked || !linkedToPrevious(i + 1)) push(projection.latitude, projection.longitude);
	}

	// Aucun point ne suit la référence : rien à restaurer.
	if (matchedCount === 0) return degradedShape;

	const typedPoints = new Float64Array(points.length * 3);
	let distance = 0;
	for (let i = 0; i < points.length; i++) {
		const [latitude, longitude] = points[i]!;
		if (i > 0) {
			const [previousLatitude, previousLongitude] = points[i - 1]!;
			distance += getDistance(previousLatitude, previousLongitude, latitude, longitude);
		}

		typedPoints[i * 3] = latitude;
		typedPoints[i * 3 + 1] = longitude;
		typedPoints[i * 3 + 2] = distance;
	}

	// Identifiant propre à la référence : un même tracé de déviation, appliqué à des courses dont les
	// tracés diffèrent, n'est pas restauré pareil, et le tracé publié est mis en cache sous son nom.
	return new Shape(`${degradedShape.id}~${referenceShape.id}`, typedPoints, true);
}

/**
 * Projette un point sur le tracé de référence, à moins de {@link MATCH_TOLERANCE_M} de lui.
 *
 * La recherche ne remonte pas en deçà de la projection précédente, et retient le premier passage
 * du tracé de référence à proximité du point : un tracé qui repasse par le même endroit (boucle,
 * aller-retour sur une même rue) ne fait pas sauter la projection d'un passage à l'autre.
 */
function projectOnReference(
	referenceShape: Shape,
	latitude: number,
	longitude: number,
	previous: Projection | undefined,
): Projection | undefined {
	// Projection équirectangulaire locale, en mètres autour du point.
	const metersPerDegreeLatitude = 111_320;
	const metersPerDegreeLongitude = metersPerDegreeLatitude * Math.cos((latitude * Math.PI) / 180);

	let best: (Projection & { offset: number }) | undefined;

	for (let segment = previous?.segment ?? 0; segment < referenceShape.length - 1; segment++) {
		const aLatitude = referenceShape.getPointLatitude(segment);
		const aLongitude = referenceShape.getPointLongitude(segment);
		const bLatitude = referenceShape.getPointLatitude(segment + 1);
		const bLongitude = referenceShape.getPointLongitude(segment + 1);

		const ax = (aLongitude - longitude) * metersPerDegreeLongitude;
		const ay = (aLatitude - latitude) * metersPerDegreeLatitude;
		const dx = (bLongitude - aLongitude) * metersPerDegreeLongitude;
		const dy = (bLatitude - aLatitude) * metersPerDegreeLatitude;
		const lengthSquared = dx * dx + dy * dy;

		let t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared));
		// Le point ne recule pas sur le segment de la projection précédente.
		if (previous !== undefined && segment === previous.segment) t = Math.max(t, previous.t);

		const offset = Math.hypot(ax + t * dx, ay + t * dy);

		if (offset <= MATCH_TOLERANCE_M) {
			if (best === undefined || offset < best.offset) {
				best = { segment, t, offset, latitude: 0, longitude: 0 };
			}
		} else if (best !== undefined) {
			// Fin du premier passage à proximité du point.
			break;
		}
	}

	if (best === undefined) return;

	const { segment, t } = best;
	const aLatitude = referenceShape.getPointLatitude(segment);
	const aLongitude = referenceShape.getPointLongitude(segment);
	const bLatitude = referenceShape.getPointLatitude(segment + 1);
	const bLongitude = referenceShape.getPointLongitude(segment + 1);

	// Un sommet de référence à portée du point le représente mieux que sa projection : celle-ci
	// hérite de l'arrondi du point, le sommet est exact.
	const distanceToA = getDistance(latitude, longitude, aLatitude, aLongitude);
	const distanceToB = getDistance(latitude, longitude, bLatitude, bLongitude);
	const canSnapToA = previous === undefined || segment > previous.segment || previous.t === 0;
	if (canSnapToA && distanceToA <= MATCH_TOLERANCE_M && distanceToA <= distanceToB) {
		return { segment, t: 0, latitude: aLatitude, longitude: aLongitude };
	}
	if (distanceToB <= MATCH_TOLERANCE_M) {
		// Rattachée au segment suivant, dont ce sommet est l'origine.
		if (segment + 1 < referenceShape.length - 1) {
			return { segment: segment + 1, t: 0, latitude: bLatitude, longitude: bLongitude };
		}
		return { segment, t: 1, latitude: bLatitude, longitude: bLongitude };
	}

	return {
		segment,
		t,
		latitude: aLatitude + t * (bLatitude - aLatitude),
		longitude: aLongitude + t * (bLongitude - aLongitude),
	};
}
