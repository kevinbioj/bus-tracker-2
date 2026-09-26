import type { GeoJSONFeatureDiff, GeoJSONSource } from "maplibre-gl";
import { useEffect, useRef } from "react";

import { useMap } from "~/adapters/maplibre-gl/map";
import { isLowEndDevice } from "~/utils/device-capabilities";

export type CircleMarkerSource = {
	type: "geojson";
	data: CircleMarkerFeatureCollection;
};

export type CircleMarkerFeatureCollection<T = { id: string; bearing: number | null }> = {
	type: "FeatureCollection";
	features: CircleMarkerFeature<T>[];
};

export type CircleMarkerFeature<T = { id: string; bearing: number | null }> = {
	type: "Feature";
	geometry: {
		type: "Point";
		coordinates: [number, number];
	};
	properties: T;
};

/** Durée du glissement d'un marqueur vers sa nouvelle position. */
const ANIMATION_DURATION_MS = 1000;

/**
 * Au-delà de ce nombre de marqueurs en mouvement, ils sautent directement à leur nouvelle position :
 * chaque image renvoie leurs positions au worker, qui recharge les tuiles qui les portent et replace
 * flèches et libellés — trop cher à cette échelle, même à cadence réduite.
 */
const ANIMATION_MAX_MOVEMENTS = 1000;

/**
 * Intervalle entre deux images de l'animation. Chaque image coûte d'autant plus cher au worker et au
 * thread principal que les marqueurs en mouvement sont nombreux : la cadence baisse avec leur nombre.
 * Peu nombreux, ils suivent l'écran (`requestAnimationFrame`) ; un appareil modeste s'en tient à 15
 * images par seconde.
 */
function frameIntervalFor(movementCount: number) {
	if (isLowEndDevice || movementCount >= 300) return 1000 / 15;
	if (movementCount >= 50) return 1000 / 30;
	return 0;
}

/** Tolérance sur l'intervalle entre deux images, pour ne pas en sauter une à la moindre gigue. */
const FRAME_INTERVAL_TOLERANCE_MS = 4;

type CircleMarkerProperties = { id: string; bearing: number | null };

/** Marqueur tel que la source l'affiche : position et propriétés courantes, animation comprise. */
type DisplayedMarker<T> = {
	coordinates: [number, number];
	properties: T;
};

type Movement = {
	id: string;
	from: [number, number];
	to: [number, number];
	fromBearing: number | null;
	toBearing: number | null;
};

/** La source identifie les marqueurs par leur `id` : c'est ce qui permet de ne lui envoyer que les différences. */
const toSourceFeature = <T extends CircleMarkerProperties>({ geometry, properties }: CircleMarkerFeature<T>) => ({
	type: "Feature" as const,
	id: properties.id,
	geometry: { type: "Point" as const, coordinates: geometry.coordinates },
	properties: { ...properties },
});

/**
 * Réunit les mises à jour d'un même marqueur : MapLibre indexe celles d'un diff par identifiant, et
 * la seconde écraserait la première lorsqu'il le fusionne avec un diff encore en attente.
 */
function mergeUpdates(updates: GeoJSONFeatureDiff[]) {
	const byId = new Map<GeoJSONFeatureDiff["id"], GeoJSONFeatureDiff>();
	for (const update of updates) {
		const previous = byId.get(update.id);
		byId.set(
			update.id,
			previous === undefined
				? update
				: {
						id: update.id,
						newGeometry: update.newGeometry ?? previous.newGeometry,
						addOrUpdateProperties: [...(previous.addOrUpdateProperties ?? []), ...(update.addOrUpdateProperties ?? [])],
					},
		);
	}
	return [...byId.values()];
}

/**
 * Animer coûte une mise à jour de la source par image : on s'en abstient quand l'utilisateur déplace
 * la carte — c'est là que les images manquées se voient —, quand il préfère moins d'animations, et
 * quand la page est cachée.
 */
const canAnimate = (map: ReturnType<typeof useMap>) =>
	!map.isMoving() &&
	document.visibilityState === "visible" &&
	!window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type MapCircleMarkersProps<T extends CircleMarkerProperties> = {
	features: CircleMarkerFeature<T>[];
	source: GeoJSONSource;
};

export function GeojsonCircles<T extends CircleMarkerProperties>({ features, source }: MapCircleMarkersProps<T>) {
	const map = useMap();

	// Marqueurs tels que la source les affiche, tenus ici plutôt que relus de la source. Ils ne valent
	// que pour la source qui les a reçus : une source recréée (contexte WebGL perdu) repart vide.
	const displayed = useRef<{ source: GeoJSONSource; markers: Map<string, DisplayedMarker<T>> } | null>(null);

	useEffect(() => {
		// Source neuve : une écriture complète, identifiants compris. Les suivantes ne porteront que les
		// différences — MapLibre ne recharge alors que les tuiles qui contiennent un marqueur modifié.
		if (displayed.current?.source !== source) {
			displayed.current = {
				source,
				markers: new Map(
					features.map((feature) => [
						feature.properties.id,
						{ coordinates: feature.geometry.coordinates, properties: { ...feature.properties } },
					]),
				),
			};
			source.setData({ type: "FeatureCollection", features: features.map(toSourceFeature) });
			return;
		}

		const markers = displayed.current.markers;
		const nextIds = new Set(features.map((feature) => feature.properties.id));

		const remove = [...markers.keys()].filter((id) => !nextIds.has(id));
		for (const id of remove) markers.delete(id);

		const add: ReturnType<typeof toSourceFeature<T>>[] = [];
		const update: GeoJSONFeatureDiff[] = [];
		const movements: Movement[] = [];

		for (const feature of features) {
			const { id } = feature.properties;
			const marker = markers.get(id);

			if (marker === undefined) {
				markers.set(id, { coordinates: feature.geometry.coordinates, properties: { ...feature.properties } });
				add.push(toSourceFeature(feature));
				continue;
			}

			// Le cap est animé à part ; les autres propriétés sont reprises telles quelles.
			const addOrUpdateProperties: { key: string; value: unknown }[] = [];
			for (const [key, value] of Object.entries(feature.properties)) {
				if (key === "bearing" || marker.properties[key as keyof T] === value) continue;
				addOrUpdateProperties.push({ key, value });
				(marker.properties as Record<string, unknown>)[key] = value;
			}

			// Le marqueur repart de l'endroit où il est affiché, y compris au milieu d'une animation
			// interrompue par cette mise à jour.
			const from = marker.coordinates;
			const to = feature.geometry.coordinates;
			const fromBearing = marker.properties.bearing;
			const toBearing = feature.properties.bearing;

			// Un cap qui apparaît est pris tel quel, un cap qui disparaît est retiré aussitôt : seul un cap
			// connu des deux côtés tourne progressivement.
			if ((fromBearing === null || toBearing === null) && fromBearing !== toBearing) {
				addOrUpdateProperties.push({ key: "bearing", value: toBearing });
				marker.properties.bearing = toBearing;
			}

			if (addOrUpdateProperties.length > 0) update.push({ id, addOrUpdateProperties });

			if (
				from[0] !== to[0] ||
				from[1] !== to[1] ||
				(fromBearing !== null && toBearing !== null && toBearing !== fromBearing)
			) {
				movements.push({ id, from, to, fromBearing: marker.properties.bearing, toBearing });
			}
		}

		/** Positions et caps à l'avancement `t`, relevés comme affichés et prêts à envoyer à la source. */
		const movementsAt = (t: number): GeoJSONFeatureDiff[] => {
			const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
			return movements.map(({ id, from, to, fromBearing, toBearing }) => {
				const marker = markers.get(id)!;
				marker.coordinates = t === 1 ? to : [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];

				const diff: GeoJSONFeatureDiff = {
					id,
					newGeometry: { type: "Point", coordinates: marker.coordinates },
				};
				if (fromBearing !== null && toBearing !== null && fromBearing !== toBearing) {
					const bearingDelta = ((toBearing - fromBearing + 540) % 360) - 180;
					marker.properties.bearing = t === 1 ? toBearing : (fromBearing + bearingDelta * ease + 360) % 360;
					diff.addOrUpdateProperties = [{ key: "bearing", value: marker.properties.bearing }];
				}
				return diff;
			});
		};

		// Rien ne bouge, trop de marqueurs pour les animer, ou un moment mal choisi : une seule écriture,
		// directement aux positions finales.
		if (movements.length === 0 || movements.length > ANIMATION_MAX_MOVEMENTS || !canAnimate(map)) {
			const updates = mergeUpdates([...update, ...movementsAt(1)]);
			if (remove.length > 0 || add.length > 0 || updates.length > 0)
				source.updateData({ remove, add, update: updates });
			return;
		}

		// Première écriture immédiate : marqueurs ajoutés et retirés apparaissent sans attendre.
		if (remove.length > 0 || add.length > 0 || update.length > 0) source.updateData({ remove, add, update });

		const frameInterval = frameIntervalFor(movements.length);
		const start = performance.now();
		let lastFrame = start;
		let frameRequest: number | null = null;

		const stop = () => {
			if (frameRequest !== null) cancelAnimationFrame(frameRequest);
			frameRequest = null;
			map.off("movestart", finish);
		};

		// Un déplacement de la carte qui commence met fin à l'animation : les marqueurs gagnent aussitôt
		// leur position, plutôt que de disputer chaque image au déplacement.
		const finish = () => {
			stop();
			source.updateData({ update: movementsAt(1) });
		};

		const step = (now: number) => {
			const t = Math.min(1, (now - start) / ANIMATION_DURATION_MS);
			// La dernière image n'est jamais sautée : le marqueur finit exactement à sa position.
			if (t < 1 && now - lastFrame < frameInterval - FRAME_INTERVAL_TOLERANCE_MS) {
				frameRequest = requestAnimationFrame(step);
				return;
			}

			lastFrame = now;
			source.updateData({ update: movementsAt(t) });

			if (t < 1) {
				frameRequest = requestAnimationFrame(step);
			} else {
				stop();
			}
		};

		map.on("movestart", finish);
		frameRequest = requestAnimationFrame(step);

		return stop;
	}, [features, map, source]);

	return null;
}
