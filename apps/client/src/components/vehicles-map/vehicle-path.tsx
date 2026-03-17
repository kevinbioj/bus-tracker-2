import { useQuery } from "@tanstack/react-query";
import type maplibregl from "maplibre-gl";
import { useEffect, useMemo } from "react";
import { useLocalStorage } from "usehooks-ts";

import { useMapLayer } from "~/adapters/maplibre-gl/use-map-layer";
import { useMapSource } from "~/adapters/maplibre-gl/use-map-source";
import { GetLineQuery } from "~/api/lines";
import { GetPathQuery, GetVehicleJourneyQuery } from "~/api/vehicle-journeys";

const pastPathStrokeLayer: maplibregl.AddLayerObject = {
	id: "vehicle-path-past-stroke",
	source: "vehicle-path",
	type: "line",
	layout: {
		"line-cap": "round",
		"line-join": "round",
	},
	paint: {
		"line-color": ["get", "strokeColor"],
		"line-width": 6,
		"line-opacity": 0.3,
	},
	filter: ["==", ["get", "type"], "past"],
};

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

const futurePathStrokeLayer: maplibregl.AddLayerObject = {
	id: "vehicle-path-future-stroke",
	source: "vehicle-path",
	type: "line",
	layout: {
		"line-cap": "round",
		"line-join": "round",
	},
	paint: {
		"line-color": ["get", "strokeColor"],
		"line-width": 6,
		"line-opacity": 1,
	},
	filter: ["==", ["get", "type"], "future"],
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

	const { data: journey } = useQuery(GetVehicleJourneyQuery(journeyId, true));
	const { data: path } = useQuery(GetPathQuery(showVehiclePaths ? journey?.pathRef : undefined));
	const { data: line } = useQuery(GetLineQuery(journey?.lineId));
	const geojson = useMemo<GeoJSON.FeatureCollection>(() => {
		if (path === undefined || line === undefined || !showVehiclePaths) {
			return { type: "FeatureCollection", features: [] };
		}

		const points = path.p;
		const currentDistanceTraveled = journey?.position.distanceTraveled ?? 0;

		const pastPoints: number[][] = [];
		const futurePoints: number[][] = [];

		for (const [latitude, longitude, distanceTraveled] of points) {
			const coords = [longitude, latitude];
			if (distanceTraveled !== undefined) {
				if (distanceTraveled <= currentDistanceTraveled) {
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
			for (const [latitude, longitude] of points) {
				futurePoints.push([longitude, latitude]);
			}
		}

		const pathColor = line.color ? `#${line.color}` : "#000000";
		const pathStrokeColor = line.textColor ? `#${line.textColor}` : "#FFFFFF";

		const features: GeoJSON.Feature[] = [];

		if (pastPoints.length > 1) {
			features.push({
				type: "Feature",
				geometry: { type: "LineString", coordinates: pastPoints },
				properties: { type: "past", color: pathColor, strokeColor: pathStrokeColor },
			});
		}

		if (futurePoints.length > 1) {
			features.push({
				type: "Feature",
				geometry: { type: "LineString", coordinates: futurePoints },
				properties: { type: "future", color: pathColor, strokeColor: pathStrokeColor },
			});
		}

		return { type: "FeatureCollection", features };
	}, [journey, path, line, showVehiclePaths]);

	const source = useMapSource<maplibregl.GeoJSONSource>("vehicle-path", initialSource);
	useMapLayer(pastPathStrokeLayer, "vehicles");
	useMapLayer(pastPathLayer, "vehicles");
	useMapLayer(futurePathStrokeLayer, "vehicles");
	useMapLayer(futurePathLayer, "vehicles");

	useEffect(() => {
		if (source) {
			source.setData(geojson);
		}
	}, [source, geojson]);

	return null;
}
