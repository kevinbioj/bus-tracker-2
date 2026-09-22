import type { VehicleJourneyPath } from "@bus-tracker/contracts";
import { useQuery } from "@tanstack/react-query";
import type { AddLayerObject, GeoJSONSource, SourceSpecification } from "maplibre-gl";
import { useEffect, useMemo } from "react";
import { useLocalStorage } from "usehooks-ts";

import { useMap } from "~/adapters/maplibre-gl/map";
import { isStyleLoaded } from "~/adapters/maplibre-gl/style";
import { useMapLayer } from "~/adapters/maplibre-gl/use-map-layer";
import { useMapSource } from "~/adapters/maplibre-gl/use-map-source";
import { GetLinePathQuery, GetLineQuery } from "~/api/lines";
import { GetJourneyPathsQuery, GetVehicleJourneyQuery } from "~/api/vehicle-journeys";
import { usePathDisplayMode } from "~/components/vehicles-map/path-display-mode";
import type { StopLabelsStyle } from "~/components/vehicles-map/stop-labels-style";

/** Jaune des dessertes supplémentaires, repris de la pop-up (`yellow-600`, lisible sur fond clair
 * comme sur fond sombre — la carte, elle, ne suit pas le thème). */
const EXTRA_STOP_COLOR = "#CA8A04";

const CANCELLED_PATH_WIDTH = 5;
const CANCELLED_PATH_YELLOW = "#FACC15";
const CANCELLED_PATH_BLACK = "#18181B";
const CANCELLED_PATH_PATTERN_ID = "cancelled-path-hatch";
const CANCELLED_PATH_PATTERN_HEIGHT = 32;
/** Tuile une fois et demie plus longue que haute : sur un ruban fin, le motif s'espace assez pour
 * rester lisible — `line-pattern` cale la hauteur de l'image sur la largeur de la ligne et répète
 * la longueur à ratio constant. */
const CANCELLED_PATH_PATTERN_WIDTH = 48;
/** Opacité du ruban une fois la déviation franchie par le véhicule : il ne le concerne plus. */
const CANCELLED_PATH_PASSED_OPACITY = 0.35;
/**
 * Écart au-delà duquel l'extrémité d'une portion abandonnée n'est pas tenue pour raccordée au tracé
 * suivi. Le processeur soude ces extrémités au tracé jusqu'à 20 m ; au-delà, elles restent libres.
 */
const CANCELLED_PATH_JOIN_MAX_OFFSET_M = 25;

/**
 * Motif de balisage de chantier — bandes noires obliques sur fond jaune — répété le long du tracé
 * par `line-pattern`.
 *
 * Les bandes ont une pente de 1 et sont dupliquées à une tuile d'écart de part et d'autre : elles
 * se raccordent ainsi exactement à elles-mêmes lorsque le motif se répète en longueur.
 */
function createHatchPattern() {
	const width = CANCELLED_PATH_PATTERN_WIDTH;
	const height = CANCELLED_PATH_PATTERN_HEIGHT;
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext("2d")!;

	ctx.fillStyle = CANCELLED_PATH_YELLOW;
	ctx.fillRect(0, 0, width, height);

	ctx.strokeStyle = CANCELLED_PATH_BLACK;
	// Tracées à 45°, ces bandes couvrent √2 fois leur épaisseur : le jaune reste dominant, le ruban
	// se lit comme un balisage et non comme une ligne noire.
	ctx.lineWidth = width * 0.28;
	for (const offset of [-width, 0, width]) {
		ctx.beginPath();
		ctx.moveTo(offset, 0);
		ctx.lineTo(offset + height, height);
		ctx.stroke();
	}

	return ctx.getImageData(0, 0, width, height);
}

/**
 * Tracé abandonné par une course déviée : un ruban jaune et noir façon balisage de chantier, qu'on
 * distingue au premier coup d'œil de l'itinéraire réellement suivi, lequel garde les couleurs de
 * la ligne.
 *
 * Trois couches superposées : un liseré sombre qui détache le ruban du fond de carte, la bande
 * jaune pleine, puis les hachures. La bande jaune n'est pas seulement un fond : elle garde le tracé
 * lisible tant que le motif n'est pas chargé dans le style.
 */
const cancelledPathCasingLayer: AddLayerObject = {
	id: "vehicle-path-cancelled-casing",
	source: "vehicle-path",
	type: "line",
	layout: {
		"line-cap": "round",
		"line-join": "round",
	},
	paint: {
		"line-color": CANCELLED_PATH_BLACK,
		"line-width": CANCELLED_PATH_WIDTH + 2,
		"line-opacity": ["case", ["get", "passed"], 0.3 * CANCELLED_PATH_PASSED_OPACITY, 0.3],
		"line-blur": 1,
	},
	filter: ["==", ["get", "type"], "cancelled"],
};

const cancelledPathLayer: AddLayerObject = {
	id: "vehicle-path-cancelled",
	source: "vehicle-path",
	type: "line",
	layout: {
		"line-cap": "round",
		"line-join": "round",
	},
	paint: {
		"line-color": CANCELLED_PATH_YELLOW,
		"line-width": CANCELLED_PATH_WIDTH,
		"line-opacity": ["case", ["get", "passed"], CANCELLED_PATH_PASSED_OPACITY, 1],
	},
	filter: ["==", ["get", "type"], "cancelled"],
};

const cancelledPathHatchLayer: AddLayerObject = {
	id: "vehicle-path-cancelled-hatch",
	source: "vehicle-path",
	type: "line",
	layout: {
		"line-cap": "butt",
		"line-join": "round",
	},
	paint: {
		"line-pattern": CANCELLED_PATH_PATTERN_ID,
		"line-width": CANCELLED_PATH_WIDTH,
		"line-opacity": ["case", ["get", "passed"], CANCELLED_PATH_PASSED_OPACITY, 1],
	},
	filter: ["==", ["get", "type"], "cancelled"],
};

const pastPathStrokeLayer: AddLayerObject = {
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

const pastPathLayer: AddLayerObject = {
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

const futurePathStrokeLayer: AddLayerObject = {
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

const futurePathLayer: AddLayerObject = {
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

const initialSource: SourceSpecification = {
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
	const { segment: bestSegment, t: bestT } = findNearestPointOnPath(points, latitude, longitude);

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

/**
 * Point du tracé le plus proche d'une position : le segment qui le porte, sa position sur ce
 * segment (de 0 à 1), et son écart à la position en mètres. Le tracé doit compter au moins deux
 * points.
 */
function findNearestPointOnPath(
	points: VehicleJourneyPath["p"],
	latitude: number,
	longitude: number,
): { segment: number; t: number; offsetMeters: number } {
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

	// Les écarts sont exprimés en degrés de latitude : ~111 km chacun.
	return { segment: bestSegment, t: bestT, offsetMeters: Math.sqrt(bestDistanceSquared) * 111_320 };
}

/**
 * Avancement le long du tracé, exprimé en indice de point fractionnaire (`segment + t`) : une
 * mesure commune à la position du véhicule et aux points de raccordement d'une déviation.
 *
 * Une position calculée est repérée par sa distance curviligne, qui ne confond pas les passages
 * d'un tracé repassant au même endroit ; une position GPS, par le point du tracé le plus proche.
 */
function getPathProgress(
	points: VehicleJourneyPath["p"],
	position: { latitude: number; longitude: number; distanceTraveled?: number },
) {
	if (position.distanceTraveled !== undefined) {
		for (let index = 0; index < points.length - 1; index += 1) {
			const fromDistance = points[index]![2];
			const toDistance = points[index + 1]![2];
			if (fromDistance === undefined || toDistance === undefined) break;
			if (toDistance < position.distanceTraveled) continue;

			const t =
				toDistance === fromDistance
					? 0
					: Math.max(0, (position.distanceTraveled - fromDistance) / (toDistance - fromDistance));
			return index + Math.min(1, t);
		}
	}

	const { segment, t } = findNearestPointOnPath(points, position.latitude, position.longitude);
	return segment + t;
}

type VehiclePathProps = {
	journeyId?: string;
	lineId?: number;
};

export function VehiclePath({ journeyId, lineId }: VehiclePathProps) {
	const map = useMap();
	const [pathDisplayMode] = usePathDisplayMode();
	const [stopLabelsStyle] = useLocalStorage<StopLabelsStyle>("stop-labels-style", "with-background");
	const showJourneyPath = pathDisplayMode !== "disabled" && journeyId !== undefined;

	const { data: journey } = useQuery(GetVehicleJourneyQuery(showJourneyPath ? journeyId : null, true));

	// La course détaillée peut encore être la précédente le temps d'un rendu : demander ses tracés
	// afficherait ceux d'une autre course.
	const pathsReady = showJourneyPath && journey?.id === journeyId;
	const { data: paths } = useQuery(
		GetJourneyPathsQuery(pathsReady ? journeyId : undefined, pathsReady ? journey.pathRef : undefined),
	);
	const path = paths?.path;
	const cancelledPath = paths?.cancelled;

	const journeyPathReady = journey?.id === journeyId && journey?.pathRef !== undefined && path !== undefined;
	const showLinePath =
		pathDisplayMode === "journeys-and-lines" && lineId !== undefined && (journeyId === undefined || !journeyPathReady);

	const { data: linePath } = useQuery(GetLinePathQuery(showLinePath ? lineId : undefined));

	const resolvedLineId = journey?.lineId ?? lineId;
	const { data: line, isError: lineErrored } = useQuery(GetLineQuery(resolvedLineId));
	const awaitingLineColors = resolvedLineId !== undefined && line === undefined && !lineErrored;

	const stopsLabelLayer = useMemo<AddLayerObject>(
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

	const stopsLayer = useMemo<AddLayerObject>(
		() => ({
			id: "vehicle-path-stops",
			source: "vehicle-path",
			type: "circle",
			layout: {
				visibility: stopLabelsStyle === "disabled" ? "none" : "visible",
			},
			paint: {
				// Une desserte supplémentaire reste un arrêt desservi : elle garde le gabarit des autres et
				// se signale par le seul jaune de la pop-up, sur un liseré blanc qui la détache des
				// couleurs de la ligne. L'arrêt supprimé, lui, cède la place à son ✕.
				"circle-color": ["case", ["get", "extra"], EXTRA_STOP_COLOR, ["get", "strokeColor"]],
				"circle-radius": ["case", ["get", "skipped"], 0, 4],
				"circle-stroke-width": ["case", ["get", "skipped"], 0, 1],
				"circle-stroke-color": ["case", ["get", "extra"], "#FFFFFF", ["get", "color"]],
			},
			filter: ["==", ["get", "type"], "stop"],
		}),
		[stopLabelsStyle],
	);

	const skippedStopMarkerLayer = useMemo<AddLayerObject>(
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
		if (pathDisplayMode === "disabled" || awaitingLineColors) {
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

		if (cancelledPath !== undefined) {
			const pathPoints = path?.p;
			const vehicleProgress =
				pathPoints !== undefined && pathPoints.length > 1 ? getPathProgress(pathPoints, journey.position) : undefined;

			for (const segment of cancelledPath.segments) {
				if (segment.length <= 1) continue;

				// La déviation est franchie quand le véhicule a retrouvé l'itinéraire d'origine : il a dépassé,
				// sur le tracé qu'il suit, les deux extrémités de la portion abandonnée — là où il le quitte
				// et là où il le rejoint. Tant qu'il roule sur la déviation, le ruban reste pleinement visible.
				let passed = false;
				if (pathPoints !== undefined && vehicleProgress !== undefined) {
					const ends = [segment[0]!, segment[segment.length - 1]!].map(([latitude, longitude]) =>
						findNearestPointOnPath(pathPoints, latitude, longitude),
					);
					// Une extrémité à l'écart du tracé suivi n'est pas un raccordement : la déviation ne
					// rejoint jamais l'itinéraire d'origine (jusqu'au terminus, par exemple), et le véhicule
					// ne la franchit donc pas.
					if (ends.every(({ offsetMeters }) => offsetMeters <= CANCELLED_PATH_JOIN_MAX_OFFSET_M)) {
						passed = vehicleProgress > Math.max(...ends.map(({ segment, t }) => segment + t));
					}
				}

				features.push({
					type: "Feature",
					geometry: {
						type: "LineString",
						coordinates: segment.map(([latitude, longitude]) => [longitude, latitude]),
					},
					properties: { type: "cancelled", passed },
				});
			}
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
					// Une course absente du GTFS statique n'a pas de desserte supplémentaire : toute la course
					// l'est. Marquer chacun de ses arrêts n'apprendrait rien, comme dans la pop-up.
					const extra = !journey.isAdded && call.callStatus === "UNSCHEDULED";
					features.push({
						type: "Feature",
						geometry: { type: "Point", coordinates: [call.longitude, call.latitude] },
						properties: {
							type: "stop",
							name: call.stopName,
							color: pathColor,
							strokeColor: pathStrokeColor,
							skipped,
							extra,
						},
					});
				}
			}
		}

		return { type: "FeatureCollection", features };
	}, [awaitingLineColors, cancelledPath, journey, journeyId, path, line, linePath, pathDisplayMode, showLinePath]);

	const source = useMapSource<GeoJSONSource>("vehicle-path", initialSource);
	// Ajoutées avant les autres : chaque couche s'empile au-dessus de la précédente, le tracé
	// abandonné doit rester sous l'itinéraire réellement suivi.
	useMapLayer(cancelledPathCasingLayer, "vehicles-arrows-outline");
	useMapLayer(cancelledPathLayer, "vehicles-arrows-outline");
	useMapLayer(cancelledPathHatchLayer, "vehicles-arrows-outline");
	useMapLayer(pastPathStrokeLayer, "vehicles-arrows-outline");
	useMapLayer(pastPathLayer, "vehicles-arrows-outline");
	useMapLayer(futurePathStrokeLayer, "vehicles-arrows-outline");
	useMapLayer(futurePathLayer, "vehicles-arrows-outline");
	useMapLayer(stopsLayer, "vehicles-arrows-outline");
	useMapLayer(skippedStopMarkerLayer, "vehicles-arrows-outline");
	useMapLayer(stopsLabelLayer, "vehicles-arrows-outline");

	useEffect(() => {
		let abort = false;

		const addPatternWhenReady = () => {
			if (abort) return;
			if (!isStyleLoaded(map)) return;
			if (map.getImage(CANCELLED_PATH_PATTERN_ID) !== undefined) return;

			// Doublé pour rester net sur les écrans à forte densité comme sur la mise à l'échelle
			// du motif à la largeur du tracé.
			map.addImage(CANCELLED_PATH_PATTERN_ID, createHatchPattern(), { pixelRatio: 2 });
		};

		addPatternWhenReady();

		map.on("load", addPatternWhenReady);
		// le motif disparaît avec le style qui le porte : il est rechargé avec le nouveau
		map.on("styledata", addPatternWhenReady);

		return () => {
			abort = true;
			map.off("load", addPatternWhenReady);
			map.off("styledata", addPatternWhenReady);

			if (isStyleLoaded(map) && map.getImage(CANCELLED_PATH_PATTERN_ID) !== undefined) {
				map.removeImage(CANCELLED_PATH_PATTERN_ID);
			}
		};
	}, [map]);

	useEffect(() => {
		if (source) {
			source.setData(geojson);
		}
	}, [source, geojson]);

	return null;
}
