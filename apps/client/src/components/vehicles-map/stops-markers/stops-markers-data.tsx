import type { StopAreaMode } from "@bus-tracker/contracts";
import { type QueryObserverResult, useQueries, useQuery } from "@tanstack/react-query";
import type { GeoJSONSource } from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDebounceValue } from "usehooks-ts";

import { useMap } from "~/adapters/maplibre-gl/map";
import { useMapBounds } from "~/adapters/maplibre-gl/use-map-bounds";
import { GetNetworkQuery, GetNetworksQuery, type Line, type NetworkWithDetails } from "~/api/networks";
import { isRealtimeAvailable, useRealtimeStatus } from "~/api/realtime";
import {
	GetStopDeparturesQuery,
	GetStopMarkersQuery,
	type StopDepartures,
	type StopMarker,
	type StopPoint,
} from "~/api/stops";
import { useStopLinesDisplayMode } from "~/components/vehicles-map/stop-lines-display-mode";
import { findHomonyms } from "~/components/vehicles-map/stops-markers/homonyms";
import {
	createLineBadges,
	LINE_BADGES_FONT,
	type LineBadges,
	lineBadgesImageId,
} from "~/components/vehicles-map/stops-markers/line-badges";
import {
	STOP_POINTS_LOAD_ZOOM,
	STOPS_MIN_ZOOM,
	type StopFeatureKind,
} from "~/components/vehicles-map/stops-markers/stops-markers-layer";
import { useRealtimeStops } from "~/components/vehicles-map/stops-markers/use-realtime-stops";

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
		badges?: string;
	}
>;

const MAX_LINE_BADGES = 5;

/** Au-delà, deux quais homonymes de réseaux différents sont trop éloignés pour être confondus. */
const STOP_POINT_HOMONYM_DISTANCE_M = 30;

/** Marqueur, avec ce qui le désigne pour le rapprochement des homonymes. */
type StopCandidate = { feature: StopFeature; name: string; networkId: number; latitude: number; longitude: number };

/**
 * Marqueurs d'une station : elle-même, puis ses quais lorsqu'ils sont chargés — la couche se charge
 * de n'en montrer qu'une partie selon le zoom. Une station dont les quais sont inconnus en reçoit un
 * à sa propre position, pour rester affichée au-delà du seuil. Sur une ligne filtrée, seuls ses quais.
 */
function featuresOf(
	area: Area,
	withStopPoints: boolean,
	selection: Selection,
	lineOnly: boolean,
	badgesOf: (area: Area, point?: StopPoint) => string | undefined,
): StopCandidate[] {
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
		const badges = lineOnly ? undefined : badgesOf(area, point);
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
					...(badges !== undefined ? { badges } : {}),
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

function combineLines(networks: QueryObserverResult<NetworkWithDetails>[]) {
	return new Map(networks.flatMap(({ data: network }) => network?.lines.map((line) => [line.id, line] as const) ?? []));
}

function compareLines(networkId: number) {
	return (a: Line & { networkId: number }, b: Line & { networkId: number }) => {
		const networkDiff = Number(a.networkId !== networkId) - Number(b.networkId !== networkId);
		const sortOrderDiff = (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER);
		return networkDiff || sortOrderDiff || a.number.localeCompare(b.number, undefined, { numeric: true });
	};
}

const isFontLoaded = () => document.fonts.check(LINE_BADGES_FONT);

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

	const lineOnly = lineId !== undefined;
	const loaded = level !== "none";

	const realtimeStatus = useRealtimeStatus();
	const realtime = isRealtimeAvailable(realtimeStatus);
	const withStopPoints = lineOnly || level === "points";

	const { data, refetch } = useQuery(
		GetStopMarkersQuery(bounds, { enabled: loaded, networkId, lineId, withStopPoints }, realtime),
	);

	useRealtimeStops({
		connected: realtimeStatus === "open",
		bounds,
		loaded,
		networkId,
		lineId,
		withStopPoints,
	});

	const [stopLinesDisplayMode] = useStopLinesDisplayMode();
	const showLines = stopLinesDisplayMode === "with";

	const lineNetworkIds = useMemo(
		() =>
			showLines
				? [
						...new Set(
							data?.items.flatMap(
								(area) =>
									area.stopPoints?.flatMap((point) => point.lines?.map(({ networkId }) => networkId) ?? []) ?? [],
							),
						),
					].toSorted((a, b) => a - b)
				: [],
		[data, showLines],
	);
	const linesById = useQueries({
		queries: lineNetworkIds.map((lineNetworkId) => GetNetworkQuery(lineNetworkId, true)),
		combine: combineLines,
	});

	const [fontLoaded, setFontLoaded] = useState(isFontLoaded);
	useEffect(() => {
		if (fontLoaded) return;
		let abort = false;
		document.fonts
			.load(LINE_BADGES_FONT)
			.catch(() => undefined)
			.then(() => {
				if (!abort) setFontLoaded(true);
			});
		return () => {
			abort = true;
		};
	}, [fontLoaded]);

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
		...GetStopDeparturesQuery(selectedRef, "departures", lineId, realtime),
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

		if (!realtime) refetch();
	}, [realtime, bounds, networkId, lineId, loaded, level]);

	const { geojson, badges } = useMemo(() => {
		// Tant que le tableau n'est pas chargé, seule une station sélectionnée est connue de l'URL.
		const selectedStopRef = selectedStop?.ref ?? (selectedStopPointRef === null ? selectedRef : null);
		const selection = { stopRef: selectedStopRef, stopPointRef: selectedStopPointRef };
		const withStopPoints = level === "points";

		const areas: Area[] = loaded ? (data?.items ?? []) : [];

		const badges = new Map<string, LineBadges>();
		const badgesOf = (area: Area, point?: StopPoint) => {
			if (!showLines || !fontLoaded || point?.lines === undefined) return;
			const lines = point.lines
				.flatMap(({ id, networkId }) => {
					const line = linesById.get(id);
					return line !== undefined && line.archivedAt === null ? [{ ...line, networkId }] : [];
				})
				.toSorted(compareLines(area.networkId));
			if (lines.length === 0) return;
			const lineBadges = {
				lines: lines.slice(0, MAX_LINE_BADGES),
				more: Math.max(0, lines.length - MAX_LINE_BADGES),
			};
			const imageId = lineBadgesImageId(lineBadges);
			badges.set(imageId, lineBadges);
			return imageId;
		};

		// L'arrêt sélectionné reste affiché à tout zoom, y compris hors de l'emprise chargée.
		const selectedArea =
			selectedStop !== undefined && selectedRef !== null && !areas.some((area) => area.ref === selectedStop.ref)
				? [selectedStop]
				: [];

		const candidates = [
			...areas.flatMap((area) => featuresOf(area, withStopPoints, selection, lineOnly, badgesOf)),
			// Les quais du tableau ne sont pas restreints à la ligne filtrée : seul le sélectionné est montré.
			...selectedArea.flatMap((area) =>
				featuresOf(area, withStopPoints, selection, lineOnly, badgesOf).filter(
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

		const geojson: GeoJSON.FeatureCollection = {
			type: "FeatureCollection",
			features: candidates.map(({ feature }) => feature),
		};
		return { geojson, badges };
	}, [
		data,
		fontLoaded,
		level,
		lineOnly,
		linesById,
		loaded,
		networkNames,
		selectedRef,
		selectedStop,
		selectedStopPointRef,
		showLines,
	]);

	useEffect(() => {
		const addBadges = (imageId: string) => {
			const lineBadges = badges.get(imageId);
			if (lineBadges === undefined || map.hasImage(imageId)) return;
			const { image, pixelRatio } = createLineBadges(lineBadges);
			map.addImage(imageId, image, { pixelRatio });
		};

		for (const imageId of badges.keys()) addBadges(imageId);

		const onImageMissing = ({ id }: { id: string }) => addBadges(id);
		map.on("styleimagemissing", onImageMissing);
		return () => {
			map.off("styleimagemissing", onImageMissing);
		};
	}, [badges, map]);

	useEffect(() => {
		source.setData(geojson);
	}, [geojson, source]);

	return null;
}
