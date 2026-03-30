import { useQuery } from "@tanstack/react-query";
import type maplibregl from "maplibre-gl";
import { useEffect, useMemo } from "react";
import { useLocalStorage } from "usehooks-ts";

import { useMapLayer } from "~/adapters/maplibre-gl/use-map-layer";
import { useMapSource } from "~/adapters/maplibre-gl/use-map-source";
import { GetLineQuery } from "~/api/lines";
import { GetPathQuery, GetVehicleJourneyQuery } from "~/api/vehicle-journeys";
import type { StopLabelsStyle } from "~/components/settings/stop-labels-style";

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
	journeyId?: string;
};

export function VehiclePath({ journeyId }: VehiclePathProps) {
	const [showVehiclePaths] = useLocalStorage("show-vehicle-paths", true);
	const [stopLabelsStyle] = useLocalStorage<StopLabelsStyle>("stop-labels-style", "with-background");

	const { data: journey } = useQuery(GetVehicleJourneyQuery(journeyId ?? null, true));
	const { data: path } = useQuery(GetPathQuery(showVehiclePaths ? journey?.pathRef : undefined));
	const { data: line } = useQuery(GetLineQuery(journey?.lineId));

	const stopsLabelLayer = useMemo<maplibregl.AddLayerObject>(
		() => ({
			id: "vehicle-path-stops-label",
			source: "vehicle-path",
			type: "symbol",
			layout: {
				"text-field": ["get", "name"],
				"text-font": ["Parisine Bold"],
				"text-size": 13,
				"text-offset": [0.8, 0],
				"text-anchor": "left",
				"text-allow-overlap": false,
				"text-ignore-placement": false,
				...(stopLabelsStyle === "with-background"
					? {
							"icon-image": "square-icon",
							"icon-text-fit": "both",
							"icon-text-fit-padding": [1, 3, 1, 3],
						}
					: {}),
				visibility: stopLabelsStyle === "disabled" ? "none" : "visible",
			},
			paint: {
				...(stopLabelsStyle === "with-background"
					? {
							"icon-color": ["get", "color"],
							"icon-opacity": 0.7,
						}
					: {}),
				"text-color": ["get", "strokeColor"],
				"text-halo-color": ["get", "color"],
				"text-halo-width": 1,
			},
			filter: ["==", ["get", "type"], "stop"],
		}),
		[stopLabelsStyle],
	);

	const stopsLayer = useMemo<maplibregl.AddLayerObject>(
		() => ({
			id: "vehicle-path-stops",
			source: "vehicle-path",
			type: "circle",
			layout: {
				visibility: stopLabelsStyle === "disabled" ? "none" : "visible",
			},
			paint: {
				"circle-color": ["get", "strokeColor"],
				"circle-radius": 3,
				"circle-stroke-width": 1,
				"circle-stroke-color": ["get", "color"],
			},
			filter: ["==", ["get", "type"], "stop"],
		}),
		[stopLabelsStyle],
	);

	const geojson = useMemo<GeoJSON.FeatureCollection>(() => {
		if (journey?.id !== journeyId || !showVehiclePaths || line === undefined) {
			return { type: "FeatureCollection", features: [] };
		}

		const color = line?.color ?? journey?.line?.color ?? "000000";
		const textColor = line?.textColor ?? journey?.line?.textColor ?? "FFFFFF";

		const pathColor = color.startsWith("#") ? color : `#${color}`;
		const pathStrokeColor = textColor.startsWith("#") ? textColor : `#${textColor}`;

		const features: GeoJSON.Feature[] = [];

		if (path !== undefined) {
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
		}

		if (journey?.calls !== undefined) {
			for (const call of journey.calls) {
				if (call.latitude !== undefined && call.longitude !== undefined) {
					features.push({
						type: "Feature",
						geometry: { type: "Point", coordinates: [call.longitude, call.latitude] },
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
