import { useQuery } from "@tanstack/react-query";
import maplibregl from "maplibre-gl";
import { useEffect, useMemo, useState } from "react";
import { useDebounceValue, useLocalStorage } from "usehooks-ts";

import { GeojsonCircles, type CircleMarkerFeature } from "~/adapters/maplibre-gl/geojson-circles";
import { useMap } from "~/adapters/maplibre-gl/map";
import { useMapBounds } from "~/adapters/maplibre-gl/use-map-bounds";
import { GetVehicleJourneyMarkersQuery } from "~/api/vehicle-journeys";
import { VehiclesMarkersStatusControl } from "~/components/vehicles-map/vehicles-markers/vehicles-markers-status-control";

const noise = ([lon, lat]: [number, number]): [number, number] => [
	lon + ((Math.random() * 2 - 1) * 2.5) / 111111,
	lat + ((Math.random() * 2 - 1) * 2.5) / 75000,
];

type VehiclesMarkersDataProps = {
	lineId?: number;
	networkId?: number;
	source: maplibregl.GeoJSONSource;
};

export function VehiclesMarkersData({ lineId, networkId, source }: VehiclesMarkersDataProps) {
	const map = useMap();
	const [previewVehicleNumber] = useLocalStorage("preview-vehicle-number", false);
	const [bounds] = useDebounceValue(useMapBounds(), 250);

	const { data, isFetching, refetch, isPlaceholderData } = useQuery(
		GetVehicleJourneyMarkersQuery(bounds, networkId, lineId),
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: need to refetch on bounds change
	useEffect(() => void refetch(), [bounds, refetch]);

	const [lastRefocusedLineId, setLastRefocusedLineId] = useState<number | undefined>();
	useEffect(() => {
		if (lineId === undefined) {
			setLastRefocusedLineId(undefined);
			return;
		}

		if (lineId === lastRefocusedLineId) return;
		if (isPlaceholderData || data === undefined || data.items.length === 0) return;

		const validPositions = data.items.flatMap((item) => {
			if (item.position.latitude === 0 || item.position.longitude === 0) {
				return [];
			}

			return [[item.position.longitude, item.position.latitude] as [number, number]];
		});

		if (validPositions.length === 0) return;

		const bounds = new maplibregl.LngLatBounds(validPositions[0], validPositions[0]);
		for (const pos of validPositions) {
			bounds.extend(pos);
		}

		map.fitBounds(bounds, { padding: 40, maxZoom: 15 });

		setLastRefocusedLineId(lineId);
	}, [lineId, data, isPlaceholderData, map, lastRefocusedLineId]);

	const features = useMemo<CircleMarkerFeature[]>(
		() =>
			(data?.items ?? []).map((item) => {
				const coordinates: [number, number] = [item.position.longitude, item.position.latitude];
				return {
					type: "Feature",
					id: -1,
					geometry: {
						type: "Point",
						coordinates: item.position.type === "COMPUTED" ? noise(coordinates) : coordinates,
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
