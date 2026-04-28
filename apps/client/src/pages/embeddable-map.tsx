import { useSuspenseQuery } from "@tanstack/react-query";
import maplibregl from "maplibre-gl";
import { parseAsInteger, useQueryState } from "nuqs";
import { useCallback, useMemo } from "react";
import { useParams } from "@tanstack/react-router";

import { MapComponent } from "~/adapters/maplibre-gl/map";
import { GetNetworkQuery } from "~/api/networks";
import { FilterModuleControl } from "~/components/vehicles-map/filter-module/control";
import { Signature } from "~/components/vehicles-map/signature";
import { VehiclesMarkers } from "~/components/vehicles-map/vehicles-markers/vehicles-markers-layer";

export default function EmbeddableMapPage() {
	const { networkId } = useParams({ from: "/embed/$networkId" });

	const [lineId, setLineId] = useQueryState("line-id", parseAsInteger);

	const { data: network } = useSuspenseQuery(GetNetworkQuery(+networkId, true));
	const filteredLine = network.lines.find((line) => line.id === lineId);

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

	const onMap = useCallback((map: maplibregl.Map) => {
		const searchParams = new URLSearchParams(window.location.search);

		setTimeout(() => {
			const navigationControl = new maplibregl.NavigationControl();
			map.addControl(navigationControl, "top-left");

			if (searchParams.has("with-fullscreen")) {
				const fullscreenControl = new maplibregl.FullscreenControl();
				map.addControl(fullscreenControl, "top-right");
			}

			if (searchParams.has("with-geolocate")) {
				const geolocateControl = new maplibregl.GeolocateControl({
					trackUserLocation: true,
				});
				map.addControl(geolocateControl, "top-right");
			}
		}, 100);
	}, []);

	return (
		<>
			<title>{`Carte du réseau ${network.name}`}</title>
			<style>{` body { background-color: var(--color-branding); } `}</style>
			<MapComponent containerProps={{ className: "h-dvh relative" }} mapOptions={mapOptions} ref={onMap}>
				<FilterModuleControl
					filteredLine={filteredLine}
					filteredNetwork={network}
					fixedNetworkId={+networkId}
					onFilterChange={(line) => setLineId(line?.id ?? null)}
				/>
				<VehiclesMarkers embeddedNetworkId={+networkId} lineId={filteredLine?.id} />
				<Signature />
			</MapComponent>
		</>
	);
}
