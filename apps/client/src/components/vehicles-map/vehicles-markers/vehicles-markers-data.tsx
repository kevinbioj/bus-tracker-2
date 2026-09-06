import { useQuery } from "@tanstack/react-query";
import { type GeoJSONSource, LngLatBounds } from "maplibre-gl";
import { useEffect, useMemo, useRef } from "react";
import { useDebounceValue, useLocalStorage, useWindowSize } from "usehooks-ts";

import { type CircleMarkerFeature, GeojsonCircles } from "~/adapters/maplibre-gl/geojson-circles";
import { useMap } from "~/adapters/maplibre-gl/map";
import { useMapBounds } from "~/adapters/maplibre-gl/use-map-bounds";
import {
	type DisposeableVehicleJourney,
	GetVehicleJourneyMarkersQuery,
	GetVehicleJourneyQuery,
} from "~/api/vehicle-journeys";
import { useDisplayedCountryCodes } from "~/components/vehicles-map/displayed-countries";
import { useDisplayedPositionTypes } from "~/components/vehicles-map/displayed-position-types";
import { VehiclesMarkersStatusControl } from "~/components/vehicles-map/vehicles-markers/vehicles-markers-status-control";

const hashSeed = (str: string): number => {
	let h = 1779033703 ^ str.length;
	for (let i = 0; i < str.length; i++) {
		h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
		h = (h << 13) | (h >>> 19);
	}
	return h >>> 0;
};

const mulberry32 = (seed: number) => () => {
	seed |= 0;
	seed = (seed + 0x6d2b79f5) | 0;
	let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// Offset déterministe seedé sur l'id de la course : même véhicule → même bruit,
// ce qui évite que les marqueurs COMPUTED sautent à chaque refetch/déplacement de carte.
const noise = ([lon, lat]: [number, number], seed: string): [number, number] => {
	const rand = mulberry32(hashSeed(seed));
	return [lon + ((rand() * 2 - 1) * 2.5) / 111111, lat + ((rand() * 2 - 1) * 2.5) / 75000];
};

type VehiclesMarkersDataProps = {
	/** Course dont la popup est ouverte, s'il y en a une. */
	activeJourneyId: string | null;
	embeddedNetworkId?: number;
	filteredNetworkId?: number;
	lineId?: number;
	source: GeoJSONSource;
};

export function VehiclesMarkersData({
	activeJourneyId,
	embeddedNetworkId,
	filteredNetworkId,
	lineId,
	source,
}: VehiclesMarkersDataProps) {
	const map = useMap();
	const { width: windowWidth } = useWindowSize();
	const [previewVehicleNumber] = useLocalStorage("preview-vehicle-number", false);
	const [displayedPositionTypes] = useDisplayedPositionTypes();
	const [displayedCountryCodes] = useDisplayedCountryCodes();
	const [bounds] = useDebounceValue(useMapBounds(), 250);

	const {
		data,
		dataUpdatedAt: markersUpdatedAt,
		isFetching,
		isPlaceholderData,
		refetch,
	} = useQuery(GetVehicleJourneyMarkersQuery(bounds, { embeddedNetworkId, filteredNetworkId, lineId }));

	// Détail de la course dont la popup est ouverte : c'est lui qui alimente l'horodatage,
	// les prochains arrêts et le tracé parcouru/à parcourir. Les deux requêtes n'arrivent pas
	// au même instant, donc tant que la popup est ouverte on fait suivre le marqueur de cette
	// course sur ce détail plutôt que sur la requête des marqueurs : tout décrit alors le même
	// instantané. C'est le même cache que la popup, aucune requête supplémentaire n'est émise.
	const { data: activeJourney, dataUpdatedAt: journeyUpdatedAt } = useQuery(
		GetVehicleJourneyQuery(activeJourneyId, false),
	);

	// Positions relevées sur le détail des courses dont une popup a été ouverte. Elles survivent
	// à la fermeture de la popup : le détail se rafraîchit plus souvent que les marqueurs, donc
	// rendre aussitôt la main à ces derniers ferait *reculer* le point vers un instantané plus
	// ancien. Une entrée n'est relâchée qu'une fois les marqueurs plus frais qu'elle — le point
	// avance alors sans jamais revenir en arrière.
	const journeyPositions = useRef(new Map<string, { position: DisposeableVehicleJourney["position"]; at: number }>());

	const positionOverrides = useMemo(() => {
		const overrides = journeyPositions.current;

		if (activeJourney !== undefined && journeyUpdatedAt > (overrides.get(activeJourney.id)?.at ?? 0)) {
			overrides.set(activeJourney.id, { position: activeJourney.position, at: journeyUpdatedAt });
		}

		for (const [journeyId, override] of overrides) {
			if (journeyId !== activeJourneyId && override.at <= markersUpdatedAt) {
				overrides.delete(journeyId);
			}
		}

		return new Map(overrides);
	}, [activeJourney, activeJourneyId, journeyUpdatedAt, markersUpdatedAt]);

	// Clé du filtre actif, pour ne recadrer qu'une fois par filtre (ligne comme réseau).
	const refocusKey =
		lineId !== undefined
			? `line:${lineId}`
			: filteredNetworkId !== undefined
				? `network:${filteredNetworkId}`
				: undefined;
	const lastRefocusedFilter = useRef<string | undefined>(undefined);

	// biome-ignore lint/correctness/useExhaustiveDependencies: we need to refetch if that setting changes
	useEffect(() => {
		refetch();
	}, [
		bounds,
		displayedPositionTypes.join(","),
		displayedCountryCodes.join(","),
		lineId,
		embeddedNetworkId,
		filteredNetworkId,
	]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: only refocus when data is fresh and the filter changed
	useEffect(() => {
		if (refocusKey === undefined) {
			lastRefocusedFilter.current = undefined;
			return;
		}

		if (isPlaceholderData || isFetching || data === undefined || lastRefocusedFilter.current === refocusKey) {
			return;
		}

		const refocus = () => {
			const validPositions = data.items.flatMap((item) => {
				if (item.position.latitude === 0 || item.position.longitude === 0) {
					return [];
				}

				return [[item.position.longitude, item.position.latitude] as [number, number]];
			});

			if (validPositions.length === 0) return;

			const boundsObj = new LngLatBounds(validPositions[0], validPositions[0]);
			for (const pos of validPositions) {
				boundsObj.extend(pos);
			}

			const padding = windowWidth < 640 ? 40 : windowWidth < 1024 ? 100 : 200;
			map.fitBounds(boundsObj, { padding, maxZoom: 15 });
			lastRefocusedFilter.current = refocusKey;
		};

		refocus();
	}, [refocusKey, data, isPlaceholderData, isFetching, map]);

	const features = useMemo<CircleMarkerFeature[]>(
		() =>
			(data?.items ?? []).map((item) => {
				const override = positionOverrides.get(item.id);
				const position = override !== undefined ? { ...item.position, ...override.position } : item.position;
				const coordinates: [number, number] = [position.longitude, position.latitude];
				return {
					type: "Feature",
					id: -1,
					geometry: {
						type: "Point",
						coordinates: position.type === "COMPUTED" ? noise(coordinates, item.id) : coordinates,
					},
					properties: {
						...item,
						position,
						bearing: position.bearing ?? null,
						color: item.color ?? "#FFFFFF",
						fillColor: item.fillColor ?? "#000000",
						previewText:
							[
								...(item.lineNumber ? [item.lineNumber] : []),
								...(previewVehicleNumber && item.vehicleNumber ? [`n°${item.vehicleNumber}`] : []),
							].join(" | ") || null,
					},
				};
			}),
		[data, positionOverrides, previewVehicleNumber],
	);

	return (
		<>
			<VehiclesMarkersStatusControl loading={isFetching} onClick={!isFetching ? refetch : undefined} />
			<GeojsonCircles features={features} source={source} />
		</>
	);
}
