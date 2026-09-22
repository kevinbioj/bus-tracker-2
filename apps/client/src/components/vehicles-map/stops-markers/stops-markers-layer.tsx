import type {
	AddLayerObject,
	ExpressionSpecification,
	GeoJSONSource,
	MapGeoJSONFeature,
	MapMouseEvent,
	Point,
	PointLike,
	SourceSpecification,
	SymbolLayerSpecification,
} from "maplibre-gl";
import { useEffect } from "react";
import { useMediaQuery } from "usehooks-ts";

import { useMap } from "~/adapters/maplibre-gl/map";
import { isStyleLoaded } from "~/adapters/maplibre-gl/style";
import { useMapLayer } from "~/adapters/maplibre-gl/use-map-layer";
import { useMapSource } from "~/adapters/maplibre-gl/use-map-source";
import {
	createStopIcon,
	SELECTED_STOP_ICON_SCALE,
	STOP_ICON_HEIGHT,
	STOP_ICON_PIXEL_RATIO,
	STOP_ICON_WIDTH,
	STOP_PLATE_CENTER_OFFSET,
} from "~/components/vehicles-map/stops-markers/stop-icon";
import { useStopSelection } from "~/components/vehicles-map/stops-markers/stop-selection";
import { StopsMarkersData } from "~/components/vehicles-map/stops-markers/stops-markers-data";

/**
 * Zoom à partir duquel les arrêts apparaissent. Plus bas, une ville entière tient à l'écran et ses
 * milliers d'arrêts noieraient les véhicules sans rien apprendre.
 */
export const STOPS_MIN_ZOOM = 14;

/**
 * Zoom autour duquel les stations cèdent la place à leurs quais, chacun à sa position : à cette
 * échelle, les deux côtés de la rue se distinguent, et c'est le quai qu'on cherche. Pas plus tard :
 * sur un petit écran, il fallait zoomer presque à fond pour les atteindre.
 */
export const STOP_POINTS_ZOOM = 16.5;

/** Demi-largeur du fondu enchaîné entre stations et quais, de part et d'autre du seuil. */
const STOP_POINTS_FADE = 0.25;

/**
 * Zoom à partir duquel les quais sont chargés : un peu avant le fondu, pour qu'ils soient déjà là
 * lorsqu'il commence.
 */
export const STOP_POINTS_LOAD_ZOOM = STOP_POINTS_ZOOM - STOP_POINTS_FADE - 0.25;

/** Zoom à partir duquel les arrêts se nomment : plus tôt, les libellés se marchent dessus. */
const STOPS_LABEL_MIN_ZOOM = 15;

/** Au doigt, la plaque est plus petite que la cible : la zone de clic est élargie, comme pour les véhicules. */
const COARSE_POINTER_HIT_PADDING = 8;

const STOP_ICON_ID = "stop-icon";
const SELECTED_STOP_ICON_ID = "stop-icon-selected";

const LABEL_TEXT_SIZE = 12;

const initialData: SourceSpecification = {
	type: "geojson",
	data: { type: "FeatureCollection", features: [] },
};

/**
 * Nature d'un marqueur : `area`, une station, affichée jusqu'au seuil ; `point`, un de ses quais,
 * affiché au-delà. Chaque station a au moins un quai : une station d'un seul quai, ou dont les quais
 * sont inconnus, en produit un à sa propre position.
 */
export type StopFeatureKind = "area" | "point";

const FADE_START = STOP_POINTS_ZOOM - STOP_POINTS_FADE;
const FADE_END = STOP_POINTS_ZOOM + STOP_POINTS_FADE;

/** Opacité d'une station : elle apparaît (arrêts ordinaires seulement), puis s'efface au seuil. */
function fadeOutAtThreshold(appearAt?: number): ExpressionSpecification {
	return [
		"interpolate",
		["linear"],
		["zoom"],
		...(appearAt !== undefined ? [appearAt, 0, appearAt + 0.4, 1] : []),
		FADE_START,
		1,
		FADE_END,
		0,
	] as ExpressionSpecification;
}

/** Opacité d'un quai : il apparaît au seuil, à mesure que sa station s'efface. */
const fadeInAtThreshold: ExpressionSpecification = ["interpolate", ["linear"], ["zoom"], FADE_START, 0, FADE_END, 1];

const labelLayout: SymbolLayerSpecification["layout"] = {
	"text-font": ["Parisine Bold"],
	"text-size": LABEL_TEXT_SIZE,
	"text-anchor": "left",
	// Aligné sur le centre de la plaque, juste à sa droite.
	"text-offset": [(STOP_ICON_WIDTH / 2 + 3) / LABEL_TEXT_SIZE, -STOP_PLATE_CENTER_OFFSET / LABEL_TEXT_SIZE],
	"text-optional": true,
	"text-max-width": 10,
	// La pointe de la hampe marque l'emplacement exact de l'arrêt.
	"icon-anchor": "bottom",
	"icon-allow-overlap": true,
};

const labelPaint: SymbolLayerSpecification["paint"] = {
	"text-color": "#1E2A4A",
	"text-halo-color": "#FFFFFF",
	"text-halo-width": 1.5,
};

/*
 * Stations et quais vivent dans des couches distinctes, bornées par leur zoom minimal et maximal.
 * Ces bornes suivent le zoom en continu, là où une expression de zoom dans `layout` n'est évaluée
 * qu'au zoom entier de chaque tuile — le basculement n'aurait lieu qu'au rechargement des tuiles, avec
 * un retard visible. Hors de ses bornes, une couche n'est ni dessinée ni placée : ses libellés ne
 * disputent pas la place de ceux de l'autre. Les deux ne cohabitent que le temps du fondu enchaîné.
 */

/**
 * Plaque et nom de la station dans une même couche : le nom se place à droite de la plaque et cède
 * sa place en cas de collision (`text-optional`), la plaque, elle, reste toujours affichée. Le clic
 * vaut ainsi pour l'une comme pour l'autre.
 */
const areasLayerObject: AddLayerObject = {
	id: "stops-areas",
	source: "stops",
	type: "symbol",
	minzoom: STOPS_MIN_ZOOM,
	maxzoom: FADE_END,
	filter: ["all", ["==", ["get", "kind"], "area"], ["!", ["get", "selected"]]],
	layout: {
		...labelLayout,
		"icon-image": STOP_ICON_ID,
		// Seuil entier : il tombe sur un zoom de tuile, le libellé apparaît donc sans retard.
		"text-field": ["step", ["zoom"], "", STOPS_LABEL_MIN_ZOOM, ["get", "label"]],
	},
	paint: {
		...labelPaint,
		// Fondu à l'apparition, comme les flèches et les libellés des véhicules, puis au profit des quais.
		"icon-opacity": fadeOutAtThreshold(STOPS_MIN_ZOOM),
		"text-opacity": fadeOutAtThreshold(STOPS_LABEL_MIN_ZOOM),
	},
};

const pointsLayerObject: AddLayerObject = {
	id: "stops-points",
	source: "stops",
	type: "symbol",
	minzoom: FADE_START,
	filter: ["all", ["==", ["get", "kind"], "point"], ["!", ["get", "selected"]]],
	layout: {
		...labelLayout,
		"icon-image": STOP_ICON_ID,
		"text-field": ["get", "label"],
	},
	paint: {
		...labelPaint,
		"icon-opacity": fadeInAtThreshold,
		"text-opacity": fadeInAtThreshold,
	},
};

/**
 * Arrêt sélectionné, dans ses propres couches et sans zoom minimal : il reste repérable jusqu'au
 * dézoom complet, tant que son tableau de passages est ouvert. Son nom l'accompagne à tout zoom.
 */
const selectedAreasLayerObject: AddLayerObject = {
	id: "stops-selected-areas",
	source: "stops",
	type: "symbol",
	maxzoom: FADE_END,
	filter: ["all", ["==", ["get", "kind"], "area"], ["get", "selected"]],
	layout: {
		...labelLayout,
		"icon-image": SELECTED_STOP_ICON_ID,
		"icon-size": SELECTED_STOP_ICON_SCALE,
		"text-field": ["get", "label"],
	},
	paint: {
		...labelPaint,
		"icon-opacity": fadeOutAtThreshold(),
		"text-opacity": fadeOutAtThreshold(),
	},
};

const selectedPointsLayerObject: AddLayerObject = {
	id: "stops-selected-points",
	source: "stops",
	type: "symbol",
	minzoom: FADE_START,
	filter: ["all", ["==", ["get", "kind"], "point"], ["get", "selected"]],
	layout: {
		...labelLayout,
		"icon-image": SELECTED_STOP_ICON_ID,
		"icon-size": SELECTED_STOP_ICON_SCALE,
		"text-field": ["get", "label"],
	},
	paint: {
		...labelPaint,
		"icon-opacity": fadeInAtThreshold,
		"text-opacity": fadeInAtThreshold,
	},
};

/** Couches répondant au survol et au clic. */
const CLICKABLE_LAYERS = [
	areasLayerObject.id,
	pointsLayerObject.id,
	selectedAreasLayerObject.id,
	selectedPointsLayerObject.id,
];

type StopsMarkersProps = {
	networkId?: number;
};

export function StopsMarkers({ networkId }: StopsMarkersProps) {
	const map = useMap();
	const { selectedRef, stopPointRef, selectStopArea, selectStopPoint, clearSelection } = useStopSelection();
	const isCoarsePointer = useMediaQuery("(pointer: coarse)");
	const hitPadding = isCoarsePointer ? COARSE_POINTER_HIT_PADDING : 0;

	const source = useMapSource<GeoJSONSource>("stops", initialData);
	// Insérées sous les véhicules : un arrêt ne doit jamais masquer le marqueur qui s'y arrête.
	const stopsLayer = useMapLayer(areasLayerObject, "vehicles");
	useMapLayer(pointsLayerObject, "vehicles");
	useMapLayer(selectedAreasLayerObject, "vehicles");
	useMapLayer(selectedPointsLayerObject, "vehicles");

	useEffect(() => {
		let abort = false;

		const addImagesWhenReady = () => {
			if (abort) return;
			if (!isStyleLoaded(map)) return;

			for (const [imageId, selected] of [
				[STOP_ICON_ID, false],
				[SELECTED_STOP_ICON_ID, true],
			] as const) {
				if (map.getImage(imageId) === undefined) {
					map.addImage(imageId, createStopIcon(selected), { pixelRatio: STOP_ICON_PIXEL_RATIO });
				}
			}
		};

		addImagesWhenReady();

		map.on("load", addImagesWhenReady);
		// les icônes disparaissent avec le style qui les porte : elles sont rechargées avec le nouveau
		map.on("styledata", addImagesWhenReady);

		return () => {
			abort = true;
			map.off("load", addImagesWhenReady);
			map.off("styledata", addImagesWhenReady);
		};
	}, [map]);

	useEffect(() => {
		if (stopsLayer === null) return;

		const onMouseEnter = () => {
			map.getCanvas().style.cursor = "pointer";
		};

		const onMouseLeave = () => {
			map.getCanvas().style.cursor = "";
		};

		const queryArea = (point: Point): PointLike | [PointLike, PointLike] =>
			hitPadding === 0
				? point
				: [
						[point.x - hitPadding, point.y - hitPadding],
						[point.x + hitPadding, point.y + hitPadding],
					];

		/**
		 * Distance du clic au centre de la plaque de l'arrêt, ou `undefined` s'il tombe hors de l'icône.
		 * L'icône est ancrée par la pointe de sa hampe : elle s'étend au-dessus du point de l'arrêt.
		 */
		const plateDistance = (feature: MapGeoJSONFeature, point: Point) => {
			const [longitude, latitude] = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
			const anchor = map.project([longitude, latitude]);
			const scale = feature.properties.selected ? SELECTED_STOP_ICON_SCALE : 1;
			const halfWidth = (STOP_ICON_WIDTH / 2) * scale + hitPadding;

			const withinIcon =
				Math.abs(point.x - anchor.x) <= halfWidth &&
				point.y <= anchor.y + hitPadding &&
				point.y >= anchor.y - STOP_ICON_HEIGHT * scale - hitPadding;
			if (!withinIcon) return;

			return Math.hypot(point.x - anchor.x, point.y - (anchor.y - STOP_PLATE_CENTER_OFFSET * scale));
		};

		const onClick = (event: MapMouseEvent) => {
			// La pop-up des véhicules se saisit du même clic : un arrêt sous un véhicule ne doit pas
			// ouvrir les deux à la fois, et c'est le véhicule qui l'emporte — il est au-dessus.
			if (
				map.getLayer("vehicles") !== undefined &&
				map.queryRenderedFeatures(queryArea(event.point), { layers: ["vehicles"] }).length > 0
			) {
				return;
			}

			// Chaque couche porte la plaque et le nom : l'un comme l'autre ouvre l'arrêt. Pendant et après
			// le fondu, stations et quais coexistent : seul compte celui qui l'emporte à ce zoom.
			const hiddenKind: StopFeatureKind = map.getZoom() >= STOP_POINTS_ZOOM ? "area" : "point";
			const candidates = map
				.queryRenderedFeatures(queryArea(event.point), {
					layers: CLICKABLE_LAYERS.filter((layerId) => map.getLayer(layerId) !== undefined),
				})
				.filter((candidate) => candidate.properties.kind !== hiddenKind);

			// La carte ne dit pas si c'est la plaque ou le libellé qui a été touché : un nom qui déborde
			// sur la plaque d'un arrêt voisin ne doit pas la rendre inaccessible. La plaque touchée
			// l'emporte donc toujours — la plus proche du clic s'il y en a plusieurs — et le libellé ne
			// sert qu'à défaut.
			const feature =
				candidates
					.map((candidate) => ({ candidate, distance: plateDistance(candidate, event.point) }))
					.filter(({ distance }) => distance !== undefined)
					.sort((a, b) => a.distance! - b.distance!)
					.at(0)?.candidate ?? candidates.at(0);

			if (feature === undefined) {
				if (selectedRef !== null) clearSelection();
				return;
			}

			// Un quai ouvre le tableau restreint à ce quai ; une station l'ouvre en entier.
			const { ref, stopPointRef } = feature.properties as { ref: string; stopPointRef?: string };
			if (stopPointRef !== undefined) {
				selectStopPoint(stopPointRef);
			} else {
				selectStopArea(ref);
			}
		};

		for (const layerId of CLICKABLE_LAYERS) {
			map.on("mouseenter", layerId, onMouseEnter);
			map.on("mouseleave", layerId, onMouseLeave);
		}
		map.on("click", onClick);
		return () => {
			for (const layerId of CLICKABLE_LAYERS) {
				map.off("mouseenter", layerId, onMouseEnter);
				map.off("mouseleave", layerId, onMouseLeave);
			}
			map.off("click", onClick);
		};
	}, [clearSelection, hitPadding, map, selectStopArea, selectStopPoint, selectedRef, stopsLayer]);

	if (source === null) return null;
	return (
		<StopsMarkersData
			networkId={networkId}
			selectedRef={selectedRef}
			selectedStopPointRef={stopPointRef}
			source={source}
		/>
	);
}
