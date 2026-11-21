import { useSuspenseQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { FullscreenControl, GeolocateControl, type Map as MaplibreMap, NavigationControl } from "maplibre-gl";
import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { useCallback, useEffect, useMemo } from "react";

import { MapComponent } from "~/adapters/maplibre-gl/map";
import { GetNetworkQuery } from "~/api/networks";
import { useRealtimeConnection } from "~/api/realtime";
import { NoIndex } from "~/components/seo";
import { EmbedDisplaySettingsProvider } from "~/components/vehicles-map/embed-display-settings";
import { EmbedSettingsControl } from "~/components/vehicles-map/embed-settings-control";
import { FilterModuleControl } from "~/components/vehicles-map/filter-module/control";
import {
	lineIdsSearchParser,
	MAX_FILTERED_LINES,
	resolveFilteredLines,
} from "~/components/vehicles-map/filter-module/map-filter";
import { getMapStyleUrl, withAbsoluteSpriteUrls } from "~/components/vehicles-map/map-style";
import { nextCallsDisplayModes } from "~/components/vehicles-map/next-calls-display-mode";
import { Signature } from "~/components/vehicles-map/signature";
import { StopDeparturesPanel } from "~/components/vehicles-map/stop-departures-panel";
import { useStopSelection } from "~/components/vehicles-map/stops-markers/stop-selection";
import { StopsMarkers } from "~/components/vehicles-map/stops-markers/stops-markers-layer";
import { VehiclesMarkers } from "~/components/vehicles-map/vehicles-markers/vehicles-markers-layer";
import { notifyPseudoFullscreen } from "~/hooks/use-portal-container";
import * as m from "~/paraglide/messages";

export default function EmbeddableMapPage() {
	const { networkId } = useParams({ from: "/embed/$networkId" });
	useRealtimeConnection();

	const [lineIds, setLineIds] = useQueryState("line-id", lineIdsSearchParser);
	const [withFullscreen] = useQueryState("with-fullscreen", parseAsString);
	const [withGeolocate] = useQueryState("with-geolocate", parseAsString);
	// Réglages d'affichage choisis par l'intégrateur, tant que le visiteur ne les a pas changés depuis
	// la carte. Heure des prochains passages : absolue par défaut, comme dans l'application.
	const [nextCallsDisplayMode] = useQueryState(
		"next-calls-display",
		parseAsStringLiteral(nextCallsDisplayModes).withDefault("absolute"),
	);
	const [withAbsoluteRecordedTime] = useQueryState("with-absolute-recorded-time", parseAsString);
	const [withAccessibility] = useQueryState("with-accessibility", parseAsString);
	const [withBikes] = useQueryState("with-bikes", parseAsString);
	const { selectedRef: selectedStopRef } = useStopSelection();

	const { data: network } = useSuspenseQuery(GetNetworkQuery(+networkId, true));
	const filteredLines = useMemo(
		() => resolveFilteredLines(network.lines, lineIds).slice(0, MAX_FILTERED_LINES),
		[network.lines, lineIds],
	);
	const filteredLineIds = useMemo(
		() => (filteredLines.length > 0 ? filteredLines.map((line) => line.id) : undefined),
		[filteredLines],
	);

	const initialDisplaySettings = useMemo(
		() => ({
			nextCallsDisplayMode,
			displayAbsoluteRecordedTime: withAbsoluteRecordedTime !== null,
			showWheelchairAccessibility: withAccessibility !== null,
			showBikesAllowed: withBikes !== null,
		}),
		[nextCallsDisplayMode, withAbsoluteRecordedTime, withAccessibility, withBikes],
	);

	useEffect(() => {
		const elements = [document.documentElement, document.body];
		for (const element of elements) element.dataset.mapTheme = "light";
		return () => {
			for (const element of elements) delete element.dataset.mapTheme;
		};
	}, []);

	const mapOptions = useMemo(
		() => ({
			center: network.embedMapCenter
				? ([network.embedMapCenter[0], network.embedMapCenter[1]] as [number, number])
				: undefined,
			// style: "https://tiles.openfreemap.org/styles/liberty",
			style: getMapStyleUrl("light"),
			transformStyle: withAbsoluteSpriteUrls,
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
					const fullscreenControl = notifyPseudoFullscreen(new FullscreenControl());
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
			<NoIndex />
			<style>{` body { background-color: var(--color-branding); } `}</style>
			{/* Isolée : la signature reste au-dessus de la carte, mais sous le drawer des prochains passages. */}
			<EmbedDisplaySettingsProvider initialSettings={initialDisplaySettings} networkId={+networkId}>
				<MapComponent
					containerProps={{ className: "h-dvh relative isolate", "data-map-theme": "light" }}
					mapOptions={mapOptions}
					ref={onMap}
				>
					<FilterModuleControl
						filter={filteredLines.length > 0 ? { kind: "line", network, lines: filteredLines } : undefined}
						fixedNetworkId={+networkId}
						onFilterChange={(filter) =>
							setLineIds(filter?.kind === "line" ? filter.lines.map((line) => line.id) : null)
						}
						withDataLink={false}
					/>
					<VehiclesMarkers embeddedNetworkId={+networkId} lineIds={filteredLineIds} />
					{/* Comme sur la carte principale, des lignes filtrées ne montrent que leurs arrêts et leurs passages. */}
					<StopsMarkers lineIds={filteredLineIds} networkId={+networkId} />
					{selectedStopRef !== null && <StopDeparturesPanel lineIds={filteredLineIds} networkId={+networkId} />}
					<EmbedSettingsControl />
					<Signature />
				</MapComponent>
			</EmbedDisplaySettingsProvider>
		</>
	);
}
