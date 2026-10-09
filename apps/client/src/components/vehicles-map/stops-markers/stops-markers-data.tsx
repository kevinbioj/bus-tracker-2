import type { StopAreaMode } from "@bus-tracker/contracts";
import { useQuery } from "@tanstack/react-query";
import type { GeoJSONSource } from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDebounceValue } from "usehooks-ts";

import { useMap } from "~/adapters/maplibre-gl/map";
import { useMapBounds } from "~/adapters/maplibre-gl/use-map-bounds";
import { GetNetworksQuery } from "~/api/networks";
import {
	GetStopDeparturesQuery,
	GetStopMarkersQuery,
	type StopDepartures,
	type StopMarker,
	type StopPoint,
} from "~/api/stops";
import { findHomonyms } from "~/components/vehicles-map/stops-markers/homonyms";
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

type Area = Pick<StopMarker, "ref" | "name" | "latitude" | "longitude" | "mode" | "networkId" | "stopPoints">;

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
		/** Réseau de l'arrêt, nommé sous son libellé lorsqu'un homonyme d'un autre réseau est affiché. */
		network?: string;
		/** Pictogramme de la plaque : le mode le plus lourd de la station, ou du quai. */
		mode: StopAreaMode;
		selected: boolean;
	}
>;

/** Au-delà, deux quais homonymes de réseaux différents sont trop éloignés pour être confondus. */
const STOP_POINT_HOMONYM_DISTANCE_M = 30;

/** Marqueur, avec ce qui le désigne pour le rapprochement des homonymes. */
type StopCandidate = { feature: StopFeature; name: string; networkId: number; latitude: number; longitude: number };

/**
 * Marqueurs d'une station : elle-même, puis ses quais lorsqu'ils sont chargés — la couche se charge
 * de n'en montrer qu'une partie selon le zoom. Une station dont les quais sont inconnus en reçoit un
 * à sa propre position, pour rester affichée au-delà du seuil. Sur une ligne filtrée, seuls ses quais,
 * montrés à tout zoom.
 */
function featuresOf(area: Area, withStopPoints: boolean, selection: Selection, lineOnly: boolean): StopCandidate[] {
	const areaSelected = area.ref === selection.stopRef;

	const areaCandidate: StopCandidate = {
		feature: {
			type: "Feature",
			geometry: { type: "Point", coordinates: [area.longitude, area.latitude] },
			properties: { kind: "area", ref: area.ref, label: area.name, mode: area.mode, selected: areaSelected },
		},
		name: area.name,
		networkId: area.networkId,
		latitude: area.latitude,
		longitude: area.longitude,
	};

	if (!withStopPoints && !lineOnly) return [areaCandidate];

	const points: (StopPoint | undefined)[] =
		area.stopPoints !== undefined && area.stopPoints.length > 0 ? area.stopPoints : [undefined];

	const pointCandidates = points.map((point): StopCandidate => {
		const { latitude, longitude } = point ?? area;
		return {
			feature: {
				type: "Feature",
				geometry: { type: "Point", coordinates: [longitude, latitude] },
				properties: {
					kind: lineOnly ? "line-point" : "point",
					ref: area.ref,
					stopPointRef: point?.ref,
					label:
						point?.platformCode !== undefined
							? `${point.name ?? area.name} (${point.platformCode})`
							: (point?.name ?? area.name),
					mode: point?.mode ?? area.mode,
					// Sans quai désigné, tous les quais de la station sélectionnée le sont.
					selected:
						areaSelected &&
						(selection.stopPointRef === null || point === undefined || selection.stopPointRef === point.ref),
				},
			},
			// Le code de quai n'est pas du nom : « Rue Verte (A) » et « Rue Verte (B) » sont homonymes.
			name: point?.name ?? area.name,
			networkId: area.networkId,
			latitude,
			longitude,
		};
	});

	return lineOnly ? pointCandidates : [areaCandidate, ...pointCandidates];
}

const selectStop = (departures: StopDepartures) => departures.stop;

type StopsMarkersDataProps = {
	networkId?: number;
	lineId?: number;
	selectedStopPointRef: string | null;
	/** Référence du tableau ouvert : station, ou quai. */
	selectedRef: string | null;
	source: GeoJSONSource;
};

export function StopsMarkersData({
	networkId,
	lineId,
	selectedRef,
	selectedStopPointRef,
	source,
}: StopsMarkersDataProps) {
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

	// Sur une ligne filtrée, ses quais sont affichés à tout zoom.
	const lineOnly = lineId !== undefined;
	const loaded = lineOnly || level !== "none";

	const { data, refetch } = useQuery(
		GetStopMarkersQuery(bounds, {
			enabled: loaded,
			networkId,
			lineId,
			withStopPoints: lineOnly || level === "points",
		}),
	);

	const { data: networks } = useQuery(GetNetworksQuery);
	const networkNames = useMemo(
		() => new Map(networks?.map((network) => [network.id, network.name] as const)),
		[networks],
	);

	// Même requête que le tableau des passages, donc même cache : elle ne coûte rien de plus, et donne
	// la position de la station sélectionnée même lorsqu'elle sort de l'emprise ou du zoom affichés.
	// Elle donne aussi la station d'un quai sélectionné, que l'URL ne porte pas.
	// Seule la station compte ici, et non les passages : ceux-ci changent à chaque rafraîchissement
	// (toutes les 5 s), elle non — le partage structurel de React Query en garde la référence, et la
	// source des arrêts n'est pas réécrite pour rien.
	const { data: selectedStop } = useQuery({
		...GetStopDeparturesQuery(selectedRef, "departures", lineId),
		select: selectStop,
	});

	// Les bornes ne font pas partie de la clé de la requête : c'est cet effet qui redemande les
	// arrêts quand la carte bouge. Le premier rendu est ignoré, `useQuery` vient d'émettre la requête.
	const hasFetchedOnce = useRef(false);

	// biome-ignore lint/correctness/useExhaustiveDependencies: les bornes pilotent le refetch, pas la clé
	useEffect(() => {
		if (!loaded) return;

		if (!hasFetchedOnce.current) {
			hasFetchedOnce.current = true;
			return;
		}

		refetch();
	}, [bounds, networkId, lineId, loaded, level]);

	const geojson = useMemo<GeoJSON.FeatureCollection>(() => {
		// Tant que le tableau n'est pas chargé, seule une station sélectionnée est connue de l'URL.
		const selectedStopRef = selectedStop?.ref ?? (selectedStopPointRef === null ? selectedRef : null);
		const selection = { stopRef: selectedStopRef, stopPointRef: selectedStopPointRef };
		const withStopPoints = level === "points";

		const areas: Area[] = loaded ? (data?.items ?? []) : [];

		// L'arrêt sélectionné reste affiché à tout zoom, y compris hors de l'emprise chargée.
		const selectedArea =
			selectedStop !== undefined && selectedRef !== null && !areas.some((area) => area.ref === selectedStop.ref)
				? [selectedStop]
				: [];

		const candidates = [
			...areas.flatMap((area) => featuresOf(area, withStopPoints, selection, lineOnly)),
			// Les quais du tableau ne sont pas restreints à la ligne filtrée : seul le sélectionné est montré.
			...selectedArea.flatMap((area) =>
				featuresOf(area, withStopPoints, selection, lineOnly).filter(
					({ feature }) => !lineOnly || feature.properties.selected,
				),
			),
		];

		// Les stations se distinguent dès qu'un homonyme est affiché ; les quais, seulement s'il est tout proche.
		const homonyms = new Set([
			...findHomonyms(candidates.filter(({ feature }) => feature.properties.kind === "area")),
			...findHomonyms(
				candidates.filter(({ feature }) => feature.properties.kind !== "area"),
				STOP_POINT_HOMONYM_DISTANCE_M,
			),
		]);
		for (const candidate of homonyms) {
			const network = networkNames.get(candidate.networkId);
			// Une propriété présente, même indéfinie, vaut `has` pour la carte : elle n'est posée qu'au besoin.
			if (network !== undefined) candidate.feature.properties.network = network;
		}

		return { type: "FeatureCollection", features: candidates.map(({ feature }) => feature) };
	}, [data, level, lineOnly, loaded, networkNames, selectedRef, selectedStop, selectedStopPointRef]);

	useEffect(() => {
		source.setData(geojson);
	}, [geojson, source]);

	return null;
}
