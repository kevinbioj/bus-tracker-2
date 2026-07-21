import { useQuery } from "@tanstack/react-query";
import maplibregl from "maplibre-gl";
import { useEffect, useMemo, useRef } from "react";
import { useDebounceValue, useLocalStorage, useWindowSize } from "usehooks-ts";

import { type CircleMarkerFeature, GeojsonCircles } from "~/adapters/maplibre-gl/geojson-circles";
import { useMap } from "~/adapters/maplibre-gl/map";
import { useMapBounds } from "~/adapters/maplibre-gl/use-map-bounds";
import { GetVehicleJourneyMarkersQuery } from "~/api/vehicle-journeys";
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
	lineId?: number;
	networkId?: number;
	source: maplibregl.GeoJSONSource;
};

export function VehiclesMarkersData({ lineId, networkId, source }: VehiclesMarkersDataProps) {
	const map = useMap();
	const { width: windowWidth } = useWindowSize();
	const [previewVehicleNumber] = useLocalStorage("preview-vehicle-number", false);
	const [displayedPositionTypes] = useDisplayedPositionTypes();
	const [bounds] = useDebounceValue(useMapBounds(), 250);

	const { data, isFetching, isPlaceholderData, refetch } = useQuery(
		GetVehicleJourneyMarkersQuery(bounds, networkId, lineId),
	);

	const lastRefocusedLineId = useRef<number | undefined>(undefined);

	// biome-ignore lint/correctness/useExhaustiveDependencies: we need to refetch if that setting changes
	useEffect(() => {
		refetch();
	}, [bounds, displayedPositionTypes.join(","), lineId, networkId]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: only refocus when data is fresh and lineId changed
	useEffect(() => {
		if (lineId === undefined) {
			lastRefocusedLineId.current = undefined;
			return;
		}

		if (isPlaceholderData || isFetching || data === undefined || lastRefocusedLineId.current === lineId) {
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

			const boundsObj = new maplibregl.LngLatBounds(validPositions[0], validPositions[0]);
			for (const pos of validPositions) {
				boundsObj.extend(pos);
			}

			const padding = windowWidth < 640 ? 40 : windowWidth < 1024 ? 100 : 200;
			map.fitBounds(boundsObj, { padding, maxZoom: 15 });
			lastRefocusedLineId.current = lineId;
		};

		refocus();
	}, [lineId, data, isPlaceholderData, isFetching, map]);

	const features = useMemo<CircleMarkerFeature[]>(
		() =>
			(data?.items ?? []).map((item) => {
				const coordinates: [number, number] = [item.position.longitude, item.position.latitude];
				return {
					type: "Feature",
					id: -1,
					geometry: {
						type: "Point",
						coordinates: item.position.type === "COMPUTED" ? noise(coordinates, item.id) : coordinates,
					},
					properties: {
						...item,
						bearing: item.position.bearing ?? null,
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
		[data, previewVehicleNumber],
	);

	return (
		<>
			<VehiclesMarkersStatusControl loading={isFetching} onClick={!isFetching ? refetch : undefined} />
			<GeojsonCircles features={features} source={source} />
		</>
	);
}
