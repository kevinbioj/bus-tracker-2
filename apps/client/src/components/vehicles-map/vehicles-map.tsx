import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FullscreenControl, GeolocateControl, type Map as MaplibreGl, NavigationControl } from "maplibre-gl";
import { parseAsInteger, useQueryState } from "nuqs";
import { type ComponentPropsWithoutRef, useCallback, useMemo, useState } from "react";
import { useLocalStorage } from "usehooks-ts";

import { MapComponent } from "~/adapters/maplibre-gl/map";
import { GetLineQuery } from "~/api/lines";
import { GetNetworkQuery } from "~/api/networks";
import { isRealtimeAvailable, useRealtimeConnection } from "~/api/realtime";
import { GetVehicleJourneyMarkersQuery } from "~/api/vehicle-journeys";
import { MapTour } from "~/components/onboarding/map-tour";
import { DebugCoordinates } from "~/components/vehicles-map/debug-coordinates";
import { FilterModuleControl } from "~/components/vehicles-map/filter-module/control";
import {
	lineIdsSearchParser,
	MAX_FILTERED_LINES,
	type MapFilter,
	resolveFilteredLines,
} from "~/components/vehicles-map/filter-module/map-filter";
import {
	registerGeolocateControl,
	triggerGeolocateWhenReady,
	useGeolocateOnStart,
} from "~/components/vehicles-map/geolocate-on-start";
import { LineVehiclesPanel } from "~/components/vehicles-map/line-vehicles-panel";
import { MapSettingsControl } from "~/components/vehicles-map/map-settings-control";
import {
	getMapStyleUrl,
	MapThemeStyle,
	useMapTheme,
	withAbsoluteSpriteUrls,
} from "~/components/vehicles-map/map-style";
import { NearbyDeparturesButton } from "~/components/vehicles-map/nearby-departures-control";
import { NearbyDeparturesPanel } from "~/components/vehicles-map/nearby-departures-panel";
import { DEFAULT_LOCATION, PositionSave } from "~/components/vehicles-map/position-save";
import { useShowStops } from "~/components/vehicles-map/show-stops";
import { StopDeparturesPanel } from "~/components/vehicles-map/stop-departures-panel";
import { useStopSelection } from "~/components/vehicles-map/stops-markers/stop-selection";
import { StopsMarkers } from "~/components/vehicles-map/stops-markers/stops-markers-layer";
import { VehiclesMarkers } from "~/components/vehicles-map/vehicles-markers/vehicles-markers-layer";
import { useFeatureFlag } from "~/hooks/use-feature-flag";
import { notifyPseudoFullscreen, PortalThemeContext } from "~/hooks/use-portal-container";

type VehiclesMapProps = ComponentPropsWithoutRef<"div">;

export function VehiclesMap(props: VehiclesMapProps) {
	const [lineIds, setLineIds] = useQueryState("line-id", lineIdsSearchParser);
	const { selectedRef: selectedStopRef, nearby } = useStopSelection();
	const [showStops] = useShowStops();
	const [networkId, setNetworkId] = useQueryState("network-id", parseAsInteger);
	const [showIdentifiedVehiclesPanel] = useLocalStorage("show-identified-vehicles-panel", false);
	const [geolocateOnStart] = useGeolocateOnStart();
	const nearbyDeparturesEnabled = useFeatureFlag("nearby-departures");

	const realtime = isRealtimeAvailable(useRealtimeConnection());
	const urlLineIds = useMemo(
		() => (lineIds !== null && lineIds.length > 0 ? [...new Set(lineIds)].slice(0, MAX_FILTERED_LINES) : undefined),
		[lineIds],
	);
	const lineId = urlLineIds?.[0] ?? null;
	const { data: line, isPending: isLinePending } = useQuery(GetLineQuery(lineId ?? undefined, realtime));
	// Une ligne filtrée impose son réseau ; sinon le réseau filtré vient directement de l'URL.
	const resolvedNetworkId = line?.networkId ?? networkId ?? undefined;
	const isLineLoading = lineId !== null && isLinePending;
	const [lastNetworkId, setLastNetworkId] = useState(resolvedNetworkId);
	if (!isLineLoading && lastNetworkId !== resolvedNetworkId) setLastNetworkId(resolvedNetworkId);
	const filteredNetworkId = isLineLoading ? lastNetworkId : resolvedNetworkId;
	const { data: networkData } = useQuery(GetNetworkQuery(filteredNetworkId, true));
	// La requête garde les données précédentes en attendant les suivantes, y compris une fois désactivée :
	// sans ce garde-fou, le réseau quitté survivrait au filtre et restreindrait encore les arrêts.
	const filteredNetwork = networkData?.id === filteredNetworkId ? networkData : undefined;
	const filteredLines = useMemo(
		() => resolveFilteredLines(filteredNetwork?.lines ?? [], urlLineIds ?? null),
		[filteredNetwork, urlLineIds],
	);
	const filteredLineIds = useMemo(
		() => (filteredLines.length > 0 ? filteredLines.map((line) => line.id) : undefined),
		[filteredLines],
	);
	const filteredLine = filteredLines.length === 1 ? filteredLines[0] : undefined;
	const filteredNetworkOnly = lineId === null && networkId !== null ? filteredNetwork : undefined;

	const filter = useMemo<MapFilter | undefined>(() => {
		if (filteredLines.length > 0) return { kind: "line", network: filteredNetwork, lines: filteredLines };
		if (filteredNetworkOnly !== undefined) return { kind: "network", network: filteredNetworkOnly };
		return undefined;
	}, [filteredLines, filteredNetwork, filteredNetworkOnly]);

	const [initialLocation] = useState(() => {
		// location in url has priority over local storage location. Read once rather than subscribed
		// to: `PositionSave` rewrites the hash after every move, which would re-render the whole map.
		const locationHash = window.location.hash.slice(1);
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
	// Sans filtre, la couche de marqueurs démarre sur la requête non filtrée : elle peut partir dès la
	// création de la carte. Avec un filtre, la clé n'est connue qu'une fois la ligne ou le réseau chargé.
	const [shouldPrefetchMarkers] = useState(() => lineId === null && networkId === null);
	const queryClient = useQueryClient();

	const mapTheme = useMapTheme();
	const [initialMapTheme] = useState(mapTheme);

	const mapOptions = useMemo(
		() => ({
			center: initialLocation.position,
			// style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
			style: getMapStyleUrl(initialMapTheme),
			transformStyle: withAbsoluteSpriteUrls,
			zoom: initialLocation.zoom,
		}),
		[initialLocation, initialMapTheme],
	);

	const onMap = useCallback(
		(map: MaplibreGl) => {
			// Les marqueurs attendraient sinon que le style soit chargé, la couche ne se montant qu'alors :
			// la requête part en même temps que le style, et la couche la retrouve en cache.
			if (shouldPrefetchMarkers && !isRealtimeAvailable()) {
				void queryClient.prefetchQuery(GetVehicleJourneyMarkersQuery(map.getBounds()));
			}

			setTimeout(() => {
				const navigationControl = new NavigationControl();
				map.addControl(navigationControl, "top-left");

				const fullscreenControl = notifyPseudoFullscreen(new FullscreenControl());
				map.addControl(fullscreenControl, "top-right");

				const geolocateControl = new GeolocateControl({
					trackUserLocation: true,
				});
				map.addControl(geolocateControl, "top-right");
				registerGeolocateControl(map, geolocateControl);

				if (shouldGeolocateOnStart) {
					void triggerGeolocateWhenReady(map, geolocateControl);
				}
			}, 100);
		},
		[queryClient, shouldGeolocateOnStart, shouldPrefetchMarkers],
	);

	// Les deux filtres sont mutuellement exclusifs : en poser un efface toujours l'autre.
	const onFilterChange = useCallback(
		(filter?: MapFilter) => {
			setLineIds(filter?.kind === "line" ? filter.lines.map((line) => line.id) : null);
			setNetworkId(filter?.kind === "network" ? filter.network.id : null);
		},
		[setLineIds, setNetworkId],
	);

	return (
		<PortalThemeContext value={mapTheme}>
			<MapComponent containerProps={{ ...props, "data-map-theme": mapTheme }} mapOptions={mapOptions} ref={onMap}>
				<MapThemeStyle initialTheme={initialMapTheme} theme={mapTheme} />
				<PositionSave />
				<DebugCoordinates />
				<VehiclesMarkers filteredNetworkId={filteredNetworkOnly?.id} lineIds={filteredLineIds} />
				{/*
				 * Arrêts du réseau filtré, ou des lignes filtrées : celles-ci sont lues dans l'URL, pour que les
				 * arrêts des autres lignes ne s'affichent pas le temps de les charger. Elles imposent leur réseau.
				 */}
				{showStops && (
					<StopsMarkers lineIds={urlLineIds} networkId={lineId === null ? filteredNetwork?.id : undefined} />
				)}
				{showStops && selectedStopRef !== null && <StopDeparturesPanel lineIds={urlLineIds} />}
				{nearbyDeparturesEnabled && nearby && <NearbyDeparturesPanel />}
				{filteredLine !== undefined && (showIdentifiedVehiclesPanel || filteredLine.type === "RAIL") && (
					<LineVehiclesPanel
						lineId={filteredLine.id}
						rail={filteredLine.type === "RAIL"}
						timezone={filteredNetwork?.timezone}
					/>
				)}
				<FilterModuleControl filter={filter} onFilterChange={onFilterChange} />
				<MapSettingsControl />
				{nearbyDeparturesEnabled && <NearbyDeparturesButton />}
				<MapTour />
			</MapComponent>
		</PortalThemeContext>
	);
}
