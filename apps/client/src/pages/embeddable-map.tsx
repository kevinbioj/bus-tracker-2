import { useSuspenseQuery } from "@tanstack/react-query";
import maplibregl from "maplibre-gl";
import { useParams } from "react-router-dom";

import { MapComponent } from "~/adapters/maplibre-gl/map";
import { GetNetworkQuery } from "~/api/networks";
import { OnlineControl } from "~/components/vehicles-map/online-vehicles/online-control";
import { Signature } from "~/components/vehicles-map/signature";
import { VehiclesMarkers } from "~/components/vehicles-map/vehicles-markers/vehicles-markers-layer";

export default function EmbeddableMapPage() {
	const { networkId } = useParams();
	const { data } = useSuspenseQuery(GetNetworkQuery(+networkId!));

	const onMap = (map: maplibregl.Map) => {
		const navigationControl = new maplibregl.NavigationControl();
		map.addControl(navigationControl, "top-left");

		const fullscreenControl = new maplibregl.FullscreenControl();
		map.addControl(fullscreenControl, "top-right");

		const geolocateControl = new maplibregl.GeolocateControl({
			trackUserLocation: true,
		});
		map.addControl(geolocateControl, "top-right");
	};

	return (
		<>
			<title>{`Carte du réseau ${data.name}`}</title>
			<style>{` body { background-color: var(--color-branding); } `}</style>
			<MapComponent
				containerProps={{ className: "h-dvh relative" }}
				mapOptions={{
					maxBounds: data.embedMapBounds ?? undefined,
					style: "https://tiles.openfreemap.org/styles/liberty",
				}}
				ref={onMap}
			>
				<OnlineControl fixedNetworkId={+networkId!} />
				<VehiclesMarkers embeddedNetworkId={+networkId!} />
				<Signature />
			</MapComponent>
		</>
	);
}
