import type maplibregl from "maplibre-gl";
import { useEffect } from "react";

export type CircleMarkerSource = {
	type: "geojson";
	data: CircleMarkerFeatureCollection;
};

export type CircleMarkerFeatureCollection<T = { id: string; bearing?: number }> = {
	type: "FeatureCollection";
	features: CircleMarkerFeature<T>[];
};

export type CircleMarkerFeature<T = { id: string; bearing?: number }> = {
	type: "Feature";
	geometry: {
		type: "Point";
		coordinates: [number, number];
	};
	properties: T;
};

type MapCircleMarkersProps<T extends { id: string; bearing?: number }> = {
	features: CircleMarkerFeature<T>[];
	source: maplibregl.GeoJSONSource;
};

export function GeojsonCircles<T extends { id: string; bearing?: number }>({
	features,
	source,
}: MapCircleMarkersProps<T>) {
	useEffect(() => {
		let abort = false;

		async function updateMarkers() {
			if (abort) return;

			const previousCollection = ((await source.getData()) ?? {
				type: "FeatureCollection",
				features: [],
			}) as CircleMarkerFeatureCollection<T>;

			const previousLocations = previousCollection.features.reduce(
				(positions, feature) =>
					positions.set(feature.properties.id, {
						position: feature.geometry.coordinates,
						bearing: feature.properties.bearing,
					}),
				new Map<string, { position: GeoJSON.Position; bearing?: number }>(),
			);

			const nextFeatures = features.reduce(
				(featureMap, feature) => featureMap.set(feature.properties.id, feature),
				new Map<string, CircleMarkerFeature<T>>(),
			);

			const temporaryCollection = structuredClone(previousCollection);

			// 1. We remove features that no longer exist
			for (let i = 0; i < temporaryCollection.features.length; i += 1) {
				const feature = temporaryCollection.features[i];
				const nextFeature = nextFeatures.get(feature.properties.id);
				if (typeof nextFeature !== "undefined") {
					const { bearing, ...properties } = nextFeature.properties;
					feature.properties = { bearing, ...feature.properties, ...properties };
					continue;
				}

				temporaryCollection.features.splice(i, 1);
				i -= 1;
			}

			// 2. We set features that weren't there before
			for (const feature of nextFeatures.values()) {
				if (previousLocations.has(feature.properties.id)) {
					continue;
				}
				temporaryCollection.features.push(feature);
			}

			// 3. We smoothly move other features
			const start = Date.now();
			const end = Date.now() + 1000;

			function moveFeatures(now = start) {
				if (abort || source === null || now > end) return;

				const percentage = Math.min(100, (now - start) / (end - start));

				for (const feature of temporaryCollection.features) {
					const nextFeature = nextFeatures.get(feature.properties.id);
					if (typeof nextFeature === "undefined") continue;

					const previousLocation = previousLocations.get(feature.properties.id);
					if (typeof previousLocation === "undefined") continue;

					const nextPosition = nextFeature.geometry.coordinates;
					const nextBearing = nextFeature.properties.bearing;

					// update coordinates
					feature.geometry.coordinates = [
						previousLocation.position[0] + (nextPosition[0] - previousLocation.position[0]) * percentage,
						previousLocation.position[1] + (nextPosition[1] - previousLocation.position[1]) * percentage,
					];

					// update bearing
					if (typeof nextBearing === "number" && typeof previousLocation.bearing === "number") {
						const bearingDelta = ((nextBearing - previousLocation.bearing + 540) % 360) - 180;
						const t = Math.min(Math.max((now - start) / (end - start), 0), 1);
						const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
						feature.properties.bearing = (previousLocation.bearing + bearingDelta * ease + 360) % 360;
					}
				}

				source.setData(temporaryCollection);
				requestAnimationFrame(() => moveFeatures(Date.now()));
			}

			moveFeatures();
		}

		updateMarkers();
		return () => {
			abort = true;
		};
	}, [features, source]);

	return null;
}
