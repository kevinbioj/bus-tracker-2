import type { GeoJSONSource } from "maplibre-gl";
import { useEffect, useRef } from "react";

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
 * même à 30 images par seconde, l'animation coûterait trop cher.
 */
const ANIMATION_MAX_MOVEMENTS = 1000;

/**
 * Au-delà de ce nombre de marqueurs en mouvement, l'animation est ramenée à 30 images par seconde :
 * chaque image renvoie toute la collection au worker, qui la redécoupe et replace flèches et libellés.
 */
const THROTTLE_THRESHOLD = 100;
const THROTTLED_FRAME_INTERVAL_MS = 1000 / 30;
/** Tolérance sur l'intervalle entre deux images, pour ne pas en sauter une à la moindre gigue. */
const FRAME_INTERVAL_TOLERANCE_MS = 4;

type Movement<T> = {
	feature: CircleMarkerFeature<T>;
	from: [number, number];
	to: [number, number];
	fromBearing: number | null;
	toBearing: number | null;
};

type MapCircleMarkersProps<T extends { id: string; bearing: number | null }> = {
	features: CircleMarkerFeature<T>[];
	source: GeoJSONSource;
};

export function GeojsonCircles<T extends { id: string; bearing: number | null }>({
	features,
	source,
}: MapCircleMarkersProps<T>) {
	// Collection telle que la source l'affiche, tenue ici plutôt que relue et clonée à chaque mise à
	// jour. Elle ne vaut que pour la source qui l'a reçue : une source recréée (contexte WebGL perdu)
	// repart vide.
	const displayed = useRef<{ source: GeoJSONSource; collection: CircleMarkerFeatureCollection<T> } | null>(null);

	useEffect(() => {
		const previousFeatures = displayed.current?.source === source ? displayed.current.collection.features : [];
		const previousById = new Map(previousFeatures.map((feature) => [feature.properties.id, feature]));

		const movements: Movement<T>[] = [];
		const nextFeatures = features.map((nextFeature): CircleMarkerFeature<T> => {
			const previous = previousById.get(nextFeature.properties.id);
			// Copie : l'animation modifie les marqueurs en place, pas les objets reçus en props.
			const feature: CircleMarkerFeature<T> = {
				type: "Feature",
				geometry: { type: "Point", coordinates: nextFeature.geometry.coordinates },
				properties: { ...nextFeature.properties },
			};
			if (previous === undefined) return feature;

			// Le marqueur repart de l'endroit où il est affiché, y compris au milieu d'une animation
			// interrompue par cette mise à jour.
			const from = previous.geometry.coordinates;
			const to = nextFeature.geometry.coordinates;
			const fromBearing = previous.properties.bearing;
			// Un cap qui apparaît est pris tel quel, un cap qui disparaît est retiré aussitôt : seul un
			// cap connu des deux côtés tourne progressivement.
			const toBearing = nextFeature.properties.bearing;

			if (from[0] !== to[0] || from[1] !== to[1] || (fromBearing !== null && toBearing !== fromBearing)) {
				feature.geometry.coordinates = from;
				if (fromBearing !== null && toBearing !== null) feature.properties.bearing = fromBearing;
				movements.push({ feature, from, to, fromBearing, toBearing });
			}
			return feature;
		});

		const collection: CircleMarkerFeatureCollection<T> = { type: "FeatureCollection", features: nextFeatures };
		displayed.current = { source, collection };

		const applyProgress = (t: number) => {
			const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
			for (const { feature, from, to, fromBearing, toBearing } of movements) {
				feature.geometry.coordinates = [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
				if (fromBearing !== null && toBearing !== null) {
					const bearingDelta = ((toBearing - fromBearing + 540) % 360) - 180;
					feature.properties.bearing = (fromBearing + bearingDelta * ease + 360) % 360;
				}
			}
		};

		// Rien ne bouge, ou trop de marqueurs pour les animer : une seule écriture, directement aux
		// positions finales — plutôt qu'une seconde de `setData` à chaque image, et d'autant
		// d'événements `sourcedata` pour tous ceux qui écoutent la source.
		if (movements.length === 0 || movements.length > ANIMATION_MAX_MOVEMENTS) {
			applyProgress(1);
			source.setData(collection);
			return;
		}

		const frameInterval = movements.length > THROTTLE_THRESHOLD ? THROTTLED_FRAME_INTERVAL_MS : 0;
		const start = performance.now();
		let lastFrame = start;
		let frameRequest: number | null = null;

		const step = (now: number) => {
			const t = Math.min(1, (now - start) / ANIMATION_DURATION_MS);
			// La dernière image n'est jamais sautée : le marqueur finit exactement à sa position.
			if (t < 1 && now - lastFrame < frameInterval - FRAME_INTERVAL_TOLERANCE_MS) {
				frameRequest = requestAnimationFrame(step);
				return;
			}

			lastFrame = now;
			applyProgress(t);
			source.setData(collection);
			frameRequest = t < 1 ? requestAnimationFrame(step) : null;
		};

		// Première écriture immédiate : marqueurs ajoutés et retirés apparaissent sans attendre.
		source.setData(collection);
		frameRequest = requestAnimationFrame(step);

		return () => {
			if (frameRequest !== null) cancelAnimationFrame(frameRequest);
		};
	}, [features, source]);

	return null;
}
