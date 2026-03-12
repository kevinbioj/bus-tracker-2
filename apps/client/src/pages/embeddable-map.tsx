import { useSuspenseQuery } from "@tanstack/react-query";
import maplibregl from "maplibre-gl";
import { parseAsInteger, useQueryState } from "nuqs";
import { useParams } from "react-router-dom";

import { MapComponent } from "~/adapters/maplibre-gl/map";
import { GetNetworkQuery } from "~/api/networks";
import { OnlineControl } from "~/components/vehicles-map/online-vehicles/online-control";
import { Signature } from "~/components/vehicles-map/signature";
import { VehiclesMarkers } from "~/components/vehicles-map/vehicles-markers/vehicles-markers-layer";

export default function EmbeddableMapPage() {
	const { networkId } = useParams();

	const [lineId, setLineId] = useQueryState("line-id", parseAsInteger);

	const { data: network } = useSuspenseQuery(GetNetworkQuery(+networkId!, true));
	const filteredLine = network.lines.find((line) => line.id === lineId);

	const onMap = (map: maplibregl.Map) => {
		const searchParams = new URLSearchParams(location.search);

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
	};

	return (
		<>
			<title>{`Carte du réseau ${network.name}`}</title>
			<style>{` body { background-color: var(--color-branding); } `}</style>
			<MapComponent
				containerProps={{ className: "h-dvh relative" }}
				mapOptions={{
					center: network.embedMapCenter ? [network.embedMapCenter[0], network.embedMapCenter[1]] : undefined,
					style: "https://tiles.openfreemap.org/styles/liberty",
					zoom: network.embedMapCenter ? network.embedMapCenter[2] : undefined,
				}}
				ref={onMap}
			>
				<OnlineControl
					filteredLine={filteredLine}
					filteredNetwork={network}
					fixedNetworkId={+networkId!}
					onFilterChange={(line) => setLineId(line?.id ?? null)}
				/>
				<VehiclesMarkers embeddedNetworkId={+networkId!} lineId={filteredLine?.id} />
				<Signature />
			</MapComponent>
		</>
	);
}
