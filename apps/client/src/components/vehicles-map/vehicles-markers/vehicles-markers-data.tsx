import { useQuery } from "@tanstack/react-query";
import type maplibregl from "maplibre-gl";
import { useEffect, useMemo } from "react";
import { useDebounceValue, useLocalStorage } from "usehooks-ts";

import { type CircleMarkerFeature, GeojsonCircles } from "~/adapters/maplibre-gl/geojson-circles";
import { useMapBounds } from "~/adapters/maplibre-gl/use-map-bounds";
import { GetVehicleJourneyMarkersQuery, type VehicleJourneyMarker } from "~/api/vehicle-journeys";
import { VehiclesMarkersStatusControl } from "~/components/vehicles-map/vehicles-markers/vehicles-markers-status-control";

const noise = ([lon, lat]: [number, number]): [number, number] => [
	lon + ((Math.random() * 2 - 1) * 2.5) / 111111,
	lat + ((Math.random() * 2 - 1) * 2.5) / 75000,
];

type VehiclesMarkersDataProps = {
	networkId?: number;
	source: maplibregl.GeoJSONSource;
};

export function VehiclesMarkersData({ networkId, source }: VehiclesMarkersDataProps) {
	const [previewVehicleNumber] = useLocalStorage("preview-vehicle-number", false);
	const [bounds] = useDebounceValue(useMapBounds(), 250);

	const { data, isFetching, refetch } = useQuery(GetVehicleJourneyMarkersQuery(bounds, networkId));

	// biome-ignore lint/correctness/useExhaustiveDependencies: need to refetch on bounds change
	useEffect(() => void refetch(), [bounds, refetch]);

	const features = useMemo<CircleMarkerFeature<VehicleJourneyMarker>[]>(
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
						previewText: [
							...(item.lineNumber ? [item.lineNumber] : []),
							...(previewVehicleNumber && item.vehicleNumber ? [`n°${item.vehicleNumber}`] : []),
						].join(" | "),
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
