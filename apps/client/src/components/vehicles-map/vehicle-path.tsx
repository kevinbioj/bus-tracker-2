import { useQuery } from "@tanstack/react-query";
import type maplibregl from "maplibre-gl";
import { useEffect, useMemo } from "react";
import { useLocalStorage } from "usehooks-ts";

import { useMapLayer } from "~/adapters/maplibre-gl/use-map-layer";
import { useMapSource } from "~/adapters/maplibre-gl/use-map-source";
import { GetLineQuery } from "~/api/lines";
import { GetVehicleJourneyQuery } from "~/api/vehicle-journeys";

const pastPathLayer: maplibregl.AddLayerObject = {
	id: "vehicle-path-past",
	source: "vehicle-path",
	type: "line",
	layout: {
		"line-cap": "round",
		"line-join": "round",
	},
	paint: {
		"line-color": ["get", "color"],
		"line-width": 4,
		"line-opacity": 0.3,
	},
	filter: ["==", ["get", "type"], "past"],
};

const futurePathLayer: maplibregl.AddLayerObject = {
	id: "vehicle-path-future",
	source: "vehicle-path",
	type: "line",
	layout: {
		"line-cap": "round",
		"line-join": "round",
	},
	paint: {
		"line-color": ["get", "color"],
		"line-width": 4,
		"line-opacity": 1,
	},
	filter: ["==", ["get", "type"], "future"],
};

const initialSource: maplibregl.SourceSpecification = {
	type: "geojson",
	data: { type: "FeatureCollection", features: [] },
};

type VehiclePathProps = {
	journeyId: string;
};

export function VehiclePath({ journeyId }: VehiclePathProps) {
	const [showVehiclePaths] = useLocalStorage("show-vehicle-paths", false);

	const { data: journey } = useQuery(GetVehicleJourneyQuery(journeyId));
	const { data: line } = useQuery(GetLineQuery(journey?.lineId));

	const geojson = useMemo<GeoJSON.FeatureCollection>(() => {
		if (journey?.path === undefined || line === undefined || !showVehiclePaths)
			return { type: "FeatureCollection", features: [] };

		const points = journey.path.points;
		const distanceTraveled = journey.position.distanceTraveled ?? 0;

		const pastPoints: number[][] = [];
		const futurePoints: number[][] = [];

		for (const point of points) {
			const coords = [point.longitude, point.latitude];
			if (point.distanceTraveled !== undefined) {
				if (point.distanceTraveled <= distanceTraveled) {
					pastPoints.push(coords);
				} else {
					if (pastPoints.length > 0 && futurePoints.length === 0) {
						// Add the last past point to future points to have a continuous line
						futurePoints.push(pastPoints.at(-1)!);
					}
					futurePoints.push(coords);
				}
			} else {
				// Fallback if no distanceTraveled
				futurePoints.push(coords);
			}
		}

		// If all points are in futurePoints but we are at the start
		if (futurePoints.length === 0 && pastPoints.length > 0) {
			// All points are in the past
		}

		// If no distanceTraveled was provided, we just show everything as future
		if (futurePoints.length === 0 && pastPoints.length === 0 && points.length > 0) {
			for (const point of points) {
				futurePoints.push([point.longitude, point.latitude]);
			}
		}

		const pathColor = line.color ? `#${line.color}` : "#000000";

		const features: GeoJSON.Feature[] = [];

		if (pastPoints.length > 1) {
			features.push({
				type: "Feature",
				geometry: { type: "LineString", coordinates: pastPoints },
				properties: { type: "past", color: pathColor },
			});
		}

		if (futurePoints.length > 1) {
			features.push({
				type: "Feature",
				geometry: { type: "LineString", coordinates: futurePoints },
				properties: { type: "future", color: pathColor },
			});
		}

		return { type: "FeatureCollection", features };
	}, [journey, line, showVehiclePaths]);

	const source = useMapSource<maplibregl.GeoJSONSource>("vehicle-path", initialSource);
	useMapLayer(pastPathLayer, "vehicles");
	useMapLayer(futurePathLayer, "vehicles");

	useEffect(() => {
		if (source) {
			source.setData(geojson);
		}
	}, [source, geojson]);

	return null;
}
