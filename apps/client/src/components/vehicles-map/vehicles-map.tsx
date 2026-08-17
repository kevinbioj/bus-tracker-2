import { useQuery } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import { FullscreenControl, GeolocateControl, type Map as MaplibreGl, NavigationControl } from "maplibre-gl";
import { parseAsInteger, useQueryState } from "nuqs";
import { type ComponentPropsWithoutRef, useCallback, useMemo, useState } from "react";
import { useLocalStorage } from "usehooks-ts";

import { MapComponent } from "~/adapters/maplibre-gl/map";
import { GetLineQuery } from "~/api/lines";
import { GetNetworkQuery } from "~/api/networks";
import { FilterModuleControl } from "~/components/vehicles-map/filter-module/control";
import type { MapFilter } from "~/components/vehicles-map/filter-module/map-filter";
import { LineVehiclesPanel } from "~/components/vehicles-map/line-vehicles-panel";
import { DEFAULT_LOCATION, PositionSave } from "~/components/vehicles-map/position-save";
import { VehiclesMarkers } from "~/components/vehicles-map/vehicles-markers/vehicles-markers-layer";

type VehiclesMapProps = ComponentPropsWithoutRef<"div">;

export function VehiclesMap(props: VehiclesMapProps) {
	const locationHash = useLocation({ select: (state) => state.hash });

	const [lineId, setLineId] = useQueryState("line-id", parseAsInteger);
	const [networkId, setNetworkId] = useQueryState("network-id", parseAsInteger);
	const [showIdentifiedVehiclesPanel] = useLocalStorage("show-identified-vehicles-panel", false);

	const { data: line } = useQuery(GetLineQuery(lineId ?? undefined));
	// Une ligne filtrée impose son réseau ; sinon le réseau filtré vient directement de l'URL.
	const { data: filteredNetwork } = useQuery(GetNetworkQuery(line?.networkId ?? networkId ?? undefined, true));
	const filteredLine = filteredNetwork?.lines.find((line) => line.id === lineId);
	const filteredNetworkOnly = lineId === null && networkId !== null ? filteredNetwork : undefined;

	const filter = useMemo<MapFilter | undefined>(() => {
		if (filteredLine !== undefined) return { kind: "line", network: filteredNetwork, line: filteredLine };
		if (filteredNetworkOnly !== undefined) return { kind: "network", network: filteredNetworkOnly };
		return undefined;
	}, [filteredLine, filteredNetwork, filteredNetworkOnly]);

	const [initialLocation] = useState(() => {
		// location in url has priority over local storage location
		if (locationHash) {
			const [lng, lat, zoom] = locationHash.split(",").map(Number);
			if (!Number.isNaN(lng) && !Number.isNaN(lat) && !Number.isNaN(zoom)) {
				return { position: { lng, lat }, zoom };
			}
		}

		const rawCurrentLocation = localStorage.getItem("current-location");
		if (rawCurrentLocation === null) return DEFAULT_LOCATION;

		try {
			return JSON.parse(rawCurrentLocation) as typeof DEFAULT_LOCATION;
		} catch {
			localStorage.removeItem("current-location");
			return DEFAULT_LOCATION;
		}
	});

	const mapOptions = useMemo(
		() => ({
			center: initialLocation.position,
			// style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
			style: "/map-styles/liberty-fr.json",
			zoom: initialLocation.zoom,
		}),
		[initialLocation],
	);

	const onMap = useCallback((map: MaplibreGl) => {
		setTimeout(() => {
			const navigationControl = new NavigationControl();
			map.addControl(navigationControl, "top-left");

			const fullscreenControl = new FullscreenControl();
			map.addControl(fullscreenControl, "top-right");

			const geolocateControl = new GeolocateControl({
				trackUserLocation: true,
			});
			map.addControl(geolocateControl, "top-right");
		}, 100);
	}, []);

	// Les deux filtres sont mutuellement exclusifs : en poser un efface toujours l'autre.
	const onFilterChange = useCallback(
		(filter?: MapFilter) => {
			setLineId(filter?.kind === "line" ? filter.line.id : null);
			setNetworkId(filter?.kind === "network" ? filter.network.id : null);
		},
		[setLineId, setNetworkId],
	);

	return (
		<MapComponent containerProps={props} mapOptions={mapOptions} ref={onMap}>
			<PositionSave />
			<VehiclesMarkers filteredNetworkId={filteredNetworkOnly?.id} lineId={filteredLine?.id} />
			{showIdentifiedVehiclesPanel && filteredLine !== undefined && (
				<LineVehiclesPanel lineId={filteredLine.id} timezone={filteredNetwork?.timezone} />
			)}
			<FilterModuleControl filter={filter} onFilterChange={onFilterChange} />
		</MapComponent>
	);
}
