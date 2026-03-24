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

const stopsLayer: maplibregl.AddLayerObject = {
	id: "vehicle-path-stops",
	source: "vehicle-path",
	type: "circle",
	paint: {
		"circle-color": ["get", "strokeColor"],
		"circle-radius": 3,
		"circle-stroke-width": 1,
		"circle-stroke-color": ["get", "color"],
	},
	filter: ["==", ["get", "type"], "stop"],
};

const stopsLabelLayer: maplibregl.AddLayerObject = {
	id: "vehicle-path-stops-label",
	source: "vehicle-path",
	type: "symbol",
	layout: {
		"text-field": ["get", "name"],
		"text-font": ["Achemine Bold"],
		"text-size": 12,
		"text-offset": [0.8, 0],
		"text-anchor": "left",
		"text-allow-overlap": false,
		"text-ignore-placement": false,
	},
	paint: {
		"text-color": ["get", "strokeColor"],
		"text-halo-color": ["get", "color"],
		"text-halo-width": 1,
	},
	filter: ["==", ["get", "type"], "stop"],
};

const initialSource: maplibregl.SourceSpecification = {
	type: "geojson",
	data: { type: "FeatureCollection", features: [] },
};

type VehiclePathProps = {
	journeyId?: string;
};

export function VehiclePath({ journeyId }: VehiclePathProps) {
	const [showVehiclePaths] = useLocalStorage("show-vehicle-paths", true);

	const { data: journey } = useQuery(GetVehicleJourneyQuery(journeyId ?? null, true));
	const { data: path } = useQuery(GetPathQuery(showVehiclePaths ? journey?.pathRef : undefined));
	const { data: line } = useQuery(GetLineQuery(journey?.lineId));

	const geojson = useMemo<GeoJSON.FeatureCollection>(() => {
		if (journey?.id !== journeyId || path === undefined || line === undefined || !showVehiclePaths) {
			return { type: "FeatureCollection", features: [] };
		}

		const points = path.p;
		const currentDistanceTraveled = journey?.position.distanceTraveled ?? 0;

		const pastPoints: number[][] = [];
		const futurePoints: number[][] = [];

		let lastPoint: (typeof points)[number] | undefined;
		for (const point of points) {
			const [latitude, longitude, distanceTraveled] = point;
			const coords = [longitude, latitude];

			if (distanceTraveled !== undefined) {
				if (distanceTraveled <= currentDistanceTraveled) {
					pastPoints.push(coords);
				} else {
					if (lastPoint !== undefined && lastPoint[2] !== undefined && lastPoint[2] < currentDistanceTraveled) {
						const [lastLat, lastLon, lastDist] = lastPoint;
						const t = (currentDistanceTraveled - lastDist) / (distanceTraveled - lastDist);
						const interpLat = lastLat + t * (latitude - lastLat);
						const interpLon = lastLon + t * (longitude - lastLon);
						const interpCoords = [interpLon, interpLat];
						pastPoints.push(interpCoords);
						futurePoints.push(interpCoords);
					} else if (pastPoints.length > 0 && futurePoints.length === 0) {
						// Add the last past point to future points to have a continuous line
						futurePoints.push(pastPoints.at(-1)!);
					}
					futurePoints.push(coords);
				}
			} else {
				// Fallback if no distanceTraveled
				futurePoints.push(coords);
			}
			lastPoint = point;
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

		if (journey?.calls !== undefined) {
			for (const call of journey.calls) {
				// Find coordinates for this distance
				let stopCoords: number[] | undefined;

				if (call.distanceTraveled !== undefined) {
					for (let i = 0; i < points.length - 1; i++) {
						const [lat1, lon1, dist1] = points[i];
						const [lat2, lon2, dist2] = points[i + 1];

						if (
							dist1 !== undefined &&
							dist2 !== undefined &&
							call.distanceTraveled >= dist1 &&
							call.distanceTraveled <= dist2
						) {
							if (dist1 === dist2) {
								stopCoords = [lon1, lat1];
							} else {
								const t = (call.distanceTraveled - dist1) / (dist2 - dist1);
								const interpLat = lat1 + t * (lat2 - lat1);
								const interpLon = lon1 + t * (lon2 - lon1);
								stopCoords = [interpLon, interpLat];
							}
							break;
						}
					}
				}

				// Fallback to direct coordinates if interpolation failed or distanceTraveled is missing
				if (stopCoords === undefined && call.longitude !== undefined && call.latitude !== undefined) {
					stopCoords = [call.longitude, call.latitude];
				}

				if (stopCoords !== undefined) {
					features.push({
						type: "Feature",
						geometry: { type: "Point", coordinates: stopCoords },
						properties: {
							type: "stop",
							name: call.stopName,
							color: pathColor,
							strokeColor: pathStrokeColor,
						},
					});
				}
			}
		}

		return { type: "FeatureCollection", features };
	}, [journey, journeyId, path, line, showVehiclePaths]);

	const source = useMapSource<maplibregl.GeoJSONSource>("vehicle-path", initialSource);
	useMapLayer(pastPathStrokeLayer, "vehicles-arrows");
	useMapLayer(pastPathLayer, "vehicles-arrows");
	useMapLayer(futurePathStrokeLayer, "vehicles-arrows");
	useMapLayer(futurePathLayer, "vehicles-arrows");
	useMapLayer(stopsLayer, "vehicles-arrows");
	useMapLayer(stopsLabelLayer, "vehicles-arrows");

	useEffect(() => {
		if (source) {
			source.setData(geojson);
		}
	}, [source, geojson]);

	return null;
}
