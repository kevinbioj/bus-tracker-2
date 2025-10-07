import type maplibregl from "maplibre-gl";
import { useEffect } from "react";

export type CircleMarkerSource = {
	type: "geojson";
	data: CircleMarkerFeatureCollection;
};

export type CircleMarkerFeatureCollection<T = { id: string }> = {
	type: "FeatureCollection";
	features: CircleMarkerFeature<T>[];
};

export type CircleMarkerFeature<T = { id: string }> = {
	type: "Feature";
	geometry: {
		type: "Point";
		coordinates: [number, number];
	};
	properties: T;
};

type MapCircleMarkersProps<T extends { id: string }> = {
	features: CircleMarkerFeature<T>[];
	source: maplibregl.GeoJSONSource;
};

export function GeojsonCircles<T extends { id: string }>({ features, source }: MapCircleMarkersProps<T>) {
	useEffect(() => {
		let abort = false;

		async function updateMarkers() {
			if (abort) return;

			const previousCollection = ((await source.getData()) ?? {
				type: "FeatureCollection",
				features: [],
			}) as CircleMarkerFeatureCollection<T>;

			const previousPositions = previousCollection.features.reduce(
				(positions, feature) => positions.set(feature.properties.id, feature.geometry.coordinates),
				new Map<string, GeoJSON.Position>(),
			);

			const nextFeatures = features.reduce(
				(featureMap, feature) => featureMap.set(feature.properties.id, feature),
				new Map<string, CircleMarkerFeature<T>>(),
			);

			const temporaryCollection = structuredClone(previousCollection);

			// 1. We remove features that no longer exist
			for (let i = 0; i < temporaryCollection.features.length; i += 1) {
				const feature = temporaryCollection.features[i];
				if (nextFeatures.has(feature.properties.id)) continue;

				temporaryCollection.features.splice(i, 1);
				i -= 1;
			}

			// 2. We set features that weren't there before
			for (const feature of nextFeatures.values()) {
				if (previousPositions.has(feature.properties.id)) continue;
				temporaryCollection.features.push(feature);
			}

			// 3. We smoothly move other features
			const start = Date.now();
			const end = Date.now() + 1000;

			function moveFeatures(now = start) {
				if (abort || source === null || now > end) return;

				const percentage = Math.min(100, (now - start) / (end - start));

				for (const feature of temporaryCollection.features) {
					const previousPosition = previousPositions.get(feature.properties.id);
					const nextPosition = nextFeatures.get(feature.properties.id)?.geometry.coordinates;
					if (typeof previousPosition === "undefined" || typeof nextPosition === "undefined") continue;

					feature.geometry.coordinates = [
						previousPosition[0] + (nextPosition[0] - previousPosition[0]) * percentage,
						previousPosition[1] + (nextPosition[1] - previousPosition[1]) * percentage,
					];
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
