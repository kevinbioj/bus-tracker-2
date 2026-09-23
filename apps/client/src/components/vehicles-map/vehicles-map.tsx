import { useQuery } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import { FullscreenControl, GeolocateControl, type Map as MaplibreGl, NavigationControl } from "maplibre-gl";
import { parseAsInteger, useQueryState } from "nuqs";
import { type ComponentPropsWithoutRef, useCallback, useEffect, useMemo, useState } from "react";
import { useLocalStorage } from "usehooks-ts";

import { MapComponent } from "~/adapters/maplibre-gl/map";
import { GetLineQuery } from "~/api/lines";
import { GetNetworkQuery } from "~/api/networks";
import { FilterModuleControl } from "~/components/vehicles-map/filter-module/control";
import type { MapFilter } from "~/components/vehicles-map/filter-module/map-filter";
import { triggerGeolocateWhenReady, useGeolocateOnStart } from "~/components/vehicles-map/geolocate-on-start";
import { LineVehiclesPanel } from "~/components/vehicles-map/line-vehicles-panel";
import { DEFAULT_LOCATION, PositionSave } from "~/components/vehicles-map/position-save";
import { useShowStops } from "~/components/vehicles-map/show-stops";
import { StopDeparturesPanel } from "~/components/vehicles-map/stop-departures-panel";
import { useStopSelection } from "~/components/vehicles-map/stops-markers/stop-selection";
import { StopsMarkers } from "~/components/vehicles-map/stops-markers/stops-markers-layer";
import { VehiclesMarkers } from "~/components/vehicles-map/vehicles-markers/vehicles-markers-layer";

type VehiclesMapProps = ComponentPropsWithoutRef<"div">;

export function VehiclesMap(props: VehiclesMapProps) {
	const locationHash = useLocation({ select: (state) => state.hash });

	const [lineId, setLineId] = useQueryState("line-id", parseAsInteger);
	const { selectedRef: selectedStopRef, clearSelection: clearStopSelection } = useStopSelection();
	const [showStopsSetting] = useShowStops();
	// Sur une ligne filtrée, la carte ne montre que ses véhicules et son tracé : pas d'arrêts. Le filtre
	// est lu dans l'URL, pour que les arrêts ne s'affichent pas le temps de charger la ligne.
	const showStops = showStopsSetting && lineId === null;
	const [networkId, setNetworkId] = useQueryState("network-id", parseAsInteger);
	const [showIdentifiedVehiclesPanel] = useLocalStorage("show-identified-vehicles-panel", false);
	const [geolocateOnStart] = useGeolocateOnStart();

	const { data: line } = useQuery(GetLineQuery(lineId ?? undefined));
	// Une ligne filtrée impose son réseau ; sinon le réseau filtré vient directement de l'URL.
	const filteredNetworkId = line?.networkId ?? networkId ?? undefined;
	const { data: networkData } = useQuery(GetNetworkQuery(filteredNetworkId, true));
	// La requête garde les données précédentes en attendant les suivantes, y compris une fois désactivée :
	// sans ce garde-fou, le réseau quitté survivrait au filtre et restreindrait encore les arrêts.
	const filteredNetwork = networkData?.id === filteredNetworkId ? networkData : undefined;
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

	// Figé au montage : `onMap` est dans les dépendances de l'effet qui crée la carte, donc toute
	// nouvelle identité la recréerait.
	const [shouldGeolocateOnStart] = useState(() => geolocateOnStart);

	const mapOptions = useMemo(
		() => ({
			center: initialLocation.position,
			// style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
			style: "/map-styles/liberty-fr.json",
			zoom: initialLocation.zoom,
		}),
		[initialLocation],
	);

	const onMap = useCallback(
		(map: MaplibreGl) => {
			setTimeout(() => {
				const navigationControl = new NavigationControl();
				map.addControl(navigationControl, "top-left");

				const fullscreenControl = new FullscreenControl();
				map.addControl(fullscreenControl, "top-right");

				const geolocateControl = new GeolocateControl({
					trackUserLocation: true,
				});
				map.addControl(geolocateControl, "top-right");

				if (shouldGeolocateOnStart) {
					triggerGeolocateWhenReady(map, geolocateControl);
				}
			}, 100);
		},
		[shouldGeolocateOnStart],
	);

	// Les deux filtres sont mutuellement exclusifs : en poser un efface toujours l'autre.
	const onFilterChange = useCallback(
		(filter?: MapFilter) => {
			setLineId(filter?.kind === "line" ? filter.line.id : null);
			setNetworkId(filter?.kind === "network" ? filter.network.id : null);
		},
		[setLineId, setNetworkId],
	);

	// Le filtre par ligne masque les arrêts : l'arrêt sélectionné est oublié, qu'on arrive sur la ligne
	// depuis le filtre ou par un lien, et son tableau ne ressurgit pas une fois le filtre retiré.
	useEffect(() => {
		if (lineId !== null && selectedStopRef !== null) clearStopSelection();
	}, [clearStopSelection, lineId, selectedStopRef]);

	return (
		<MapComponent containerProps={props} mapOptions={mapOptions} ref={onMap}>
			<PositionSave />
			<VehiclesMarkers filteredNetworkId={filteredNetworkOnly?.id} lineId={filteredLine?.id} />
			{showStops && <StopsMarkers networkId={filteredNetwork?.id} />}
			{showStops && selectedStopRef !== null && <StopDeparturesPanel />}
			{showIdentifiedVehiclesPanel && filteredLine !== undefined && (
				<LineVehiclesPanel lineId={filteredLine.id} timezone={filteredNetwork?.timezone} />
			)}
			<FilterModuleControl filter={filter} onFilterChange={onFilterChange} />
		</MapComponent>
	);
}
