import type { VehicleJourneyPath } from "@bus-tracker/contracts";
import { useQuery } from "@tanstack/react-query";
import type maplibregl from "maplibre-gl";
import { useEffect, useMemo } from "react";
import { useLocalStorage } from "usehooks-ts";

import { useMapLayer } from "~/adapters/maplibre-gl/use-map-layer";
import { useMapSource } from "~/adapters/maplibre-gl/use-map-source";
import { GetLinePathQuery, GetLineQuery } from "~/api/lines";
import { GetPathQuery, GetVehicleJourneyQuery } from "~/api/vehicle-journeys";
import { usePathDisplayMode } from "~/components/vehicles-map/path-display-mode";
import type { StopLabelsStyle } from "~/components/vehicles-map/stop-labels-style";

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

/**
 * Découpe un tracé en deux portions (déjà parcourue / à venir) en projetant
 * « à la louche » une position sur le polyligne.
 *
 * Utilisé pour les positions GPS, qui — contrairement aux positions calculées —
 * n'ont pas de `distanceTraveled` exploitable (souvent absent ou incomplet sur
 * le tracé). On se base donc uniquement sur la géométrie : on cherche le point
 * du tracé le plus proche du véhicule et on coupe à cet endroit.
 *
 * Les coordonnées retournées sont au format GeoJSON `[longitude, latitude]`.
 */
function splitPathAtNearestPoint(
	points: VehicleJourneyPath["p"],
	latitude: number,
	longitude: number,
): { pastPoints: number[][]; futurePoints: number[][] } {
	// Projection équirectangulaire locale : on corrige la longitude par cos(lat)
	// pour que les distances soient à peu près isotropes autour du véhicule.
	const cosLat = Math.cos((latitude * Math.PI) / 180);
	const px = longitude * cosLat;
	const py = latitude;

	let bestDistanceSquared = Number.POSITIVE_INFINITY;
	let bestSegment = 0;
	let bestT = 0;

	for (let index = 0; index < points.length - 1; index += 1) {
		const [aLat, aLon] = points[index]!;
		const [bLat, bLon] = points[index + 1]!;

		const ax = aLon * cosLat;
		const ay = aLat;
		const bx = bLon * cosLat;
		const by = bLat;

		const dx = bx - ax;
		const dy = by - ay;
		const segmentLengthSquared = dx * dx + dy * dy;

		let t = segmentLengthSquared === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / segmentLengthSquared;
		t = Math.max(0, Math.min(1, t));

		const closestX = ax + t * dx;
		const closestY = ay + t * dy;
		const offsetX = px - closestX;
		const offsetY = py - closestY;
		const distanceSquared = offsetX * offsetX + offsetY * offsetY;

		if (distanceSquared < bestDistanceSquared) {
			bestDistanceSquared = distanceSquared;
			bestSegment = index;
			bestT = t;
		}
	}

	// Point de jonction interpolé sur le segment le plus proche.
	const [segStartLat, segStartLon] = points[bestSegment]!;
	const [segEndLat, segEndLon] = points[bestSegment + 1]!;
	const junctionLat = segStartLat + bestT * (segEndLat - segStartLat);
	const junctionLon = segStartLon + bestT * (segEndLon - segStartLon);
	const junction = [junctionLon, junctionLat];

	const pastPoints: number[][] = [];
	for (let index = 0; index <= bestSegment; index += 1) {
		const [lat, lon] = points[index]!;
		pastPoints.push([lon, lat]);
	}
	pastPoints.push(junction);

	const futurePoints: number[][] = [junction];
	for (let index = bestSegment + 1; index < points.length; index += 1) {
		const [lat, lon] = points[index]!;
		futurePoints.push([lon, lat]);
	}

	return { pastPoints, futurePoints };
}

type VehiclePathProps = {
	journeyId?: string;
	lineId?: number;
};

export function VehiclePath({ journeyId, lineId }: VehiclePathProps) {
	const [pathDisplayMode] = usePathDisplayMode();
	const [stopLabelsStyle] = useLocalStorage<StopLabelsStyle>("stop-labels-style", "with-background");
	const showJourneyPath = pathDisplayMode !== "disabled" && journeyId !== undefined;

	const { data: journey } = useQuery(GetVehicleJourneyQuery(showJourneyPath ? journeyId : null, true));
	const { data: path } = useQuery(GetPathQuery(showJourneyPath ? journey?.pathRef : undefined));

	const journeyPathReady = journey?.id === journeyId && journey?.pathRef !== undefined && path !== undefined;
	const showLinePath =
		pathDisplayMode === "journeys-and-lines" && lineId !== undefined && (journeyId === undefined || !journeyPathReady);

	const { data: linePath } = useQuery(GetLinePathQuery(showLinePath ? lineId : undefined));
	const { data: line } = useQuery(GetLineQuery(journey?.lineId ?? lineId));

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
							"icon-opacity": ["case", ["get", "skipped"], 0.35, 0.7],
						}
					: {}),
				"text-color": ["get", "strokeColor"],
				"text-halo-color": ["get", "color"],
				"text-halo-width": 1,
				"text-opacity": ["case", ["get", "skipped"], 0.5, 1],
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
				"circle-radius": ["case", ["get", "skipped"], 0, 4],
				"circle-stroke-width": ["case", ["get", "skipped"], 0, 1],
				"circle-stroke-color": ["get", "color"],
			},
			filter: ["==", ["get", "type"], "stop"],
		}),
		[stopLabelsStyle],
	);

	const skippedStopMarkerLayer = useMemo<maplibregl.AddLayerObject>(
		() => ({
			id: "vehicle-path-stops-skipped",
			source: "vehicle-path",
			type: "symbol",
			layout: {
				"text-field": "✕",
				"text-font": ["Parisine Bold", "Arial Unicode MS Regular"],
				"text-size": 13,
				"text-anchor": "center",
				"text-allow-overlap": true,
				"text-ignore-placement": true,
				visibility: stopLabelsStyle === "disabled" ? "none" : "visible",
			},
			paint: {
				"text-color": "#EF4444",
				"text-halo-color": "#FFFFFF",
				"text-halo-width": 1.5,
			},
			filter: ["all", ["==", ["get", "type"], "stop"], ["==", ["get", "skipped"], true]],
		}),
		[stopLabelsStyle],
	);

	const geojson = useMemo<GeoJSON.FeatureCollection>(() => {
		if (pathDisplayMode === "disabled" || line === undefined) {
			return { type: "FeatureCollection", features: [] };
		}

		const color = line?.color ?? journey?.line?.color ?? "000000";
		const textColor = line?.textColor ?? journey?.line?.textColor ?? "FFFFFF";

		const pathColor = color.startsWith("#") ? color : `#${color}`;
		const pathStrokeColor = textColor.startsWith("#") ? textColor : `#${textColor}`;

		const features: GeoJSON.Feature[] = [];

		if (showLinePath && linePath !== undefined) {
			for (const segment of linePath.segments) {
				const coordinates = segment.map(([latitude, longitude]) => [longitude, latitude]);
				if (coordinates.length <= 1) continue;

				features.push({
					type: "Feature",
					geometry: { type: "LineString", coordinates },
					properties: { type: "future", color: pathColor, strokeColor: pathStrokeColor },
				});
			}
		}

		if (journeyId === undefined) {
			return { type: "FeatureCollection", features };
		}

		if (journey?.id !== journeyId) {
			return { type: "FeatureCollection", features };
		}

		if (path !== undefined) {
			const points = path.p;

			let pastPoints: number[][] = [];
			let futurePoints: number[][] = [];

			if (journey.position.distanceTraveled === undefined) {
				// Position GPS : pas de `distanceTraveled` fiable, on découpe le
				// tracé « à la louche » au point géométriquement le plus proche.
				if (points.length > 1) {
					({ pastPoints, futurePoints } = splitPathAtNearestPoint(
						points,
						journey.position.latitude,
						journey.position.longitude,
					));
				}
			} else {
				// Position calculée : découpe exacte via `distanceTraveled`.
				const currentDistanceTraveled = journey.position.distanceTraveled;

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
								futurePoints.push(pastPoints[pastPoints.length - 1]!);
							}
							futurePoints.push(coords);
						}
					} else {
						// Fallback if no distanceTraveled
						futurePoints.push(coords);
					}
					lastPoint = point;
				}
			}

			// If no split was possible, we just show everything as future
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
					const skipped = call.callStatus === "SKIPPED";
					features.push({
						type: "Feature",
						geometry: { type: "Point", coordinates: [call.longitude, call.latitude] },
						properties: {
							type: "stop",
							name: call.stopName,
							color: pathColor,
							strokeColor: pathStrokeColor,
							skipped,
						},
					});
				}
			}
		}

		return { type: "FeatureCollection", features };
	}, [journey, journeyId, path, line, linePath, pathDisplayMode, showLinePath]);

	const source = useMapSource<maplibregl.GeoJSONSource>("vehicle-path", initialSource);
	useMapLayer(pastPathStrokeLayer, "vehicles-arrows-outline");
	useMapLayer(pastPathLayer, "vehicles-arrows-outline");
	useMapLayer(futurePathStrokeLayer, "vehicles-arrows-outline");
	useMapLayer(futurePathLayer, "vehicles-arrows-outline");
	useMapLayer(stopsLayer, "vehicles-arrows-outline");
	useMapLayer(skippedStopMarkerLayer, "vehicles-arrows-outline");
	useMapLayer(stopsLabelLayer, "vehicles-arrows-outline");

	useEffect(() => {
		if (source) {
			source.setData(geojson);
		}
	}, [source, geojson]);

	return null;
}
