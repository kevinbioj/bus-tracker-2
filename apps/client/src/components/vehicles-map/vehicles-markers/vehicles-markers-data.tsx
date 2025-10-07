import { useQuery } from "@tanstack/react-query";
import type maplibregl from "maplibre-gl";
import { useEffect, useMemo } from "react";

import { type CircleMarkerFeature, GeojsonCircles } from "~/adapters/maplibre-gl/geojson-circles";
import { useMapBounds } from "~/adapters/maplibre-gl/use-map-bounds";
import { GetVehicleJourneyMarkersQuery, type VehicleJourneyMarker } from "~/api/vehicle-journeys";
import { VehiclesMarkersStatusControl } from "~/components/vehicles-map/vehicles-markers/vehicles-markers-status-control";

type VehiclesMarkersDataProps = {
	source: maplibregl.GeoJSONSource;
};

export function VehiclesMarkersData({ source }: VehiclesMarkersDataProps) {
	const bounds = useMapBounds();

	const { data, isFetching, refetch } = useQuery(GetVehicleJourneyMarkersQuery(bounds));

	// biome-ignore lint/correctness/useExhaustiveDependencies: need to refetch on bounds change
	useEffect(() => void refetch(), [bounds, refetch]);

	const features = useMemo<CircleMarkerFeature<VehicleJourneyMarker>[]>(
		() =>
			(data?.items ?? []).map((item) => ({
				type: "Feature",
				id: -1,
				geometry: {
					type: "Point",
					coordinates: [item.position.longitude, item.position.latitude],
				},
				properties: {
					...item,
					bearing: item.position.bearing,
					color: item.color ?? "#FFFFFF",
					fillColor: item.fillColor ?? "#000000",
				},
			})),
		[data],
	);

	return (
		<>
			<VehiclesMarkersStatusControl loading={isFetching} onClick={!isFetching ? refetch : undefined} />
			<GeojsonCircles features={features} source={source} />
		</>
	);
}
