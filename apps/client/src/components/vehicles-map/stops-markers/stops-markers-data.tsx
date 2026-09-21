import { useQuery } from "@tanstack/react-query";
import type { GeoJSONSource } from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDebounceValue } from "usehooks-ts";

import { useMap } from "~/adapters/maplibre-gl/map";
import { useMapBounds } from "~/adapters/maplibre-gl/use-map-bounds";
import { GetStopDeparturesQuery, GetStopMarkersQuery, type StopMarker, type StopPoint } from "~/api/stops";
import {
	STOP_POINTS_LOAD_ZOOM,
	STOPS_MIN_ZOOM,
	type StopFeatureKind,
} from "~/components/vehicles-map/stops-markers/stops-markers-layer";

/**
 * Granularité chargée selon le zoom : rien, les stations, puis les stations *et* leurs quais — les
 * deux coexistent pour que la couche puisse passer des unes aux autres en fondu enchaîné.
 */
type Level = "none" | "areas" | "points";

const levelAt = (zoom: number): Level =>
	zoom >= STOP_POINTS_LOAD_ZOOM ? "points" : zoom >= STOPS_MIN_ZOOM ? "areas" : "none";

type Area = Pick<StopMarker, "ref" | "name" | "latitude" | "longitude" | "stopPoints">;

type Selection = { stopRef: string | null; stopPointRef: string | null };

type StopFeature = GeoJSON.Feature<
	GeoJSON.Point,
	{
		kind: StopFeatureKind;
		/** Station, toujours : c'est elle qu'ouvre le tableau des passages. */
		ref: string;
		/** Quai, lorsque le marqueur en représente un. */
		stopPointRef?: string;
		label: string;
		selected: boolean;
	}
>;

/**
 * Marqueurs d'une station : elle-même, puis ses quais lorsqu'ils sont chargés — la couche se charge
 * de n'en montrer qu'une partie selon le zoom. Une station dont les quais sont inconnus en reçoit un
 * à sa propre position, pour rester affichée au-delà du seuil.
 */
function featuresOf(area: Area, withStopPoints: boolean, selection: Selection): StopFeature[] {
	const areaSelected = area.ref === selection.stopRef;

	const areaFeature: StopFeature = {
		type: "Feature",
		geometry: { type: "Point", coordinates: [area.longitude, area.latitude] },
		properties: { kind: "area", ref: area.ref, label: area.name, selected: areaSelected },
	};

	if (!withStopPoints) return [areaFeature];

	const points: (StopPoint | undefined)[] =
		area.stopPoints !== undefined && area.stopPoints.length > 0 ? area.stopPoints : [undefined];

	return [
		areaFeature,
		...points.map(
			(point): StopFeature => ({
				type: "Feature",
				geometry: {
					type: "Point",
					coordinates: point !== undefined ? [point.longitude, point.latitude] : [area.longitude, area.latitude],
				},
				properties: {
					kind: "point",
					ref: area.ref,
					stopPointRef: point?.ref,
					label: point?.platformCode !== undefined ? `${area.name} (${point.platformCode})` : area.name,
					// Sans quai désigné, tous les quais de la station sélectionnée le sont.
					selected:
						areaSelected &&
						(selection.stopPointRef === null || point === undefined || selection.stopPointRef === point.ref),
				},
			}),
		),
	];
}

type StopsMarkersDataProps = {
	networkId?: number;
	selectedStopPointRef: string | null;
	/** Référence du tableau ouvert : station, ou quai. */
	selectedRef: string | null;
	source: GeoJSONSource;
};

export function StopsMarkersData({ networkId, selectedRef, selectedStopPointRef, source }: StopsMarkersDataProps) {
	const map = useMap();
	const [bounds] = useDebounceValue(useMapBounds(), 250);
	const [level, setLevel] = useState(() => levelAt(map.getZoom()));

	// Suivi pendant le geste et non à sa fin : les quais doivent être chargés avant que le fondu ne
	// commence. L'état ne change qu'au franchissement d'un seuil, React ne rerend pas au-delà.
	useEffect(() => {
		const onZoom = () => setLevel(levelAt(map.getZoom()));
		map.on("zoom", onZoom);
		return () => {
			map.off("zoom", onZoom);
		};
	}, [map]);

	const { data, refetch } = useQuery(
		GetStopMarkersQuery(bounds, { enabled: level !== "none", networkId, withStopPoints: level === "points" }),
	);

	// Même requête que le tableau des passages, donc même cache : elle ne coûte rien de plus, et donne
	// la position de la station sélectionnée même lorsqu'elle sort de l'emprise ou du zoom affichés.
	// Elle donne aussi la station d'un quai sélectionné, que l'URL ne porte pas.
	const { data: selectedStop } = useQuery(GetStopDeparturesQuery(selectedRef));

	// Les bornes ne font pas partie de la clé de la requête : c'est cet effet qui redemande les
	// arrêts quand la carte bouge. Le premier rendu est ignoré, `useQuery` vient d'émettre la requête.
	const hasFetchedOnce = useRef(false);

	// biome-ignore lint/correctness/useExhaustiveDependencies: les bornes pilotent le refetch, pas la clé
	useEffect(() => {
		if (level === "none") return;

		if (!hasFetchedOnce.current) {
			hasFetchedOnce.current = true;
			return;
		}

		refetch();
	}, [bounds, networkId, level]);

	const geojson = useMemo<GeoJSON.FeatureCollection>(() => {
		// Tant que le tableau n'est pas chargé, seule une station sélectionnée est connue de l'URL.
		const selectedStopRef = selectedStop?.stop.ref ?? (selectedStopPointRef === null ? selectedRef : null);
		const selection = { stopRef: selectedStopRef, stopPointRef: selectedStopPointRef };
		const withStopPoints = level === "points";

		const areas: Area[] = level === "none" ? [] : (data?.items ?? []);

		// L'arrêt sélectionné reste affiché à tout zoom, y compris hors de l'emprise chargée.
		const stop = selectedStop?.stop;
		const selectedArea =
			stop !== undefined && selectedRef !== null && !areas.some((area) => area.ref === stop.ref) ? [stop] : [];

		return {
			type: "FeatureCollection",
			features: [...areas, ...selectedArea].flatMap((area) => featuresOf(area, withStopPoints, selection)),
		};
	}, [data, level, selectedRef, selectedStop, selectedStopPointRef]);

	useEffect(() => {
		source.setData(geojson);
	}, [geojson, source]);

	return null;
}
