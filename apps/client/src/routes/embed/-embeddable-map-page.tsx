import { useSuspenseQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { FullscreenControl, GeolocateControl, type Map as MaplibreMap, NavigationControl } from "maplibre-gl";
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { useCallback, useMemo } from "react";

import { MapComponent } from "~/adapters/maplibre-gl/map";
import { GetNetworkQuery } from "~/api/networks";
import { EmbedDisplaySettingsProvider } from "~/components/vehicles-map/embed-display-settings";
import { EmbedSettingsControl } from "~/components/vehicles-map/embed-settings-control";
import { FilterModuleControl } from "~/components/vehicles-map/filter-module/control";
import { nextCallsDisplayModes } from "~/components/vehicles-map/next-calls-display-mode";
import { Signature } from "~/components/vehicles-map/signature";
import { StopDeparturesPanel } from "~/components/vehicles-map/stop-departures-panel";
import { useStopSelection } from "~/components/vehicles-map/stops-markers/stop-selection";
import { StopsMarkers } from "~/components/vehicles-map/stops-markers/stops-markers-layer";
import { VehiclesMarkers } from "~/components/vehicles-map/vehicles-markers/vehicles-markers-layer";
import * as m from "~/paraglide/messages";

export default function EmbeddableMapPage() {
	const { networkId } = useParams({ from: "/embed/$networkId" });

	const [lineId, setLineId] = useQueryState("line-id", parseAsInteger);
	const [withFullscreen] = useQueryState("with-fullscreen", parseAsString);
	const [withGeolocate] = useQueryState("with-geolocate", parseAsString);
	// Réglages d'affichage choisis par l'intégrateur, tant que le visiteur ne les a pas changés depuis
	// la carte. Heure des prochains passages : absolue par défaut, comme dans l'application.
	const [nextCallsDisplayMode] = useQueryState(
		"next-calls-display",
		parseAsStringLiteral(nextCallsDisplayModes).withDefault("absolute"),
	);
	const [withAccessibility] = useQueryState("with-accessibility", parseAsString);
	const [withBikes] = useQueryState("with-bikes", parseAsString);
	const { selectedRef: selectedStopRef } = useStopSelection();

	const { data: network } = useSuspenseQuery(GetNetworkQuery(+networkId, true));
	const filteredLine = network.lines.find((line) => line.id === lineId);

	const initialDisplaySettings = useMemo(
		() => ({
			nextCallsDisplayMode,
			showWheelchairAccessibility: withAccessibility !== null,
			showBikesAllowed: withBikes !== null,
		}),
		[nextCallsDisplayMode, withAccessibility, withBikes],
	);

	const mapOptions = useMemo(
		() => ({
			center: network.embedMapCenter
				? ([network.embedMapCenter[0], network.embedMapCenter[1]] as [number, number])
				: undefined,
			// style: "https://tiles.openfreemap.org/styles/liberty",
			style: "/map-styles/liberty-fr.json",
			zoom: network.embedMapCenter ? network.embedMapCenter[2] : undefined,
		}),
		[network.embedMapCenter],
	);

	const onMap = useCallback(
		(map: MaplibreMap) => {
			setTimeout(() => {
				const navigationControl = new NavigationControl();
				map.addControl(navigationControl, "top-left");

				if (withFullscreen !== null) {
					const fullscreenControl = new FullscreenControl();
					map.addControl(fullscreenControl, "top-right");
				}

				if (withGeolocate !== null) {
					const geolocateControl = new GeolocateControl({
						trackUserLocation: true,
					});
					map.addControl(geolocateControl, "top-right");
				}
			}, 100);
		},
		[withFullscreen, withGeolocate],
	);

	return (
		<>
			<title>{m.page_title_embed_map({ networkName: network.name })}</title>
			<style>{` body { background-color: var(--color-branding); } `}</style>
			{/* Isolée : la signature reste au-dessus de la carte, mais sous le drawer des prochains passages. */}
			<EmbedDisplaySettingsProvider initialSettings={initialDisplaySettings} networkId={+networkId}>
				<MapComponent containerProps={{ className: "h-dvh relative isolate" }} mapOptions={mapOptions} ref={onMap}>
					<FilterModuleControl
						filter={filteredLine ? { kind: "line", network, line: filteredLine } : undefined}
						fixedNetworkId={+networkId}
						onFilterChange={(filter) => setLineId(filter?.kind === "line" ? filter.line.id : null)}
						withDataLink={false}
					/>
					<VehiclesMarkers embeddedNetworkId={+networkId} lineId={filteredLine?.id} />
					{/* Comme sur la carte principale, une ligne filtrée ne montre que ses arrêts et ses passages. */}
					<StopsMarkers lineId={filteredLine?.id} networkId={+networkId} />
					{selectedStopRef !== null && <StopDeparturesPanel lineId={filteredLine?.id} networkId={+networkId} />}
					<EmbedSettingsControl />
					<Signature />
				</MapComponent>
			</EmbedDisplaySettingsProvider>
		</>
	);
}
