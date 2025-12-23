import { useSuspenseQuery } from "@tanstack/react-query";
import maplibregl from "maplibre-gl";
import { useParams, useSearchParams } from "react-router-dom";

import { MapComponent } from "~/adapters/maplibre-gl/map";
import { GetNetworkQuery } from "~/api/networks";
import { OnlineControl } from "~/components/vehicles-map/online-vehicles/online-control";
import { Signature } from "~/components/vehicles-map/signature";
import { VehiclesMarkers } from "~/components/vehicles-map/vehicles-markers/vehicles-markers-layer";

export default function EmbeddableMapPage() {
	const { networkId } = useParams();
	const [searchParams] = useSearchParams();

	const { data } = useSuspenseQuery(GetNetworkQuery(+networkId!));

	const onMap = (map: maplibregl.Map) => {
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
			<title>{`Carte du réseau ${data.name}`}</title>
			<style>{` body { background-color: var(--color-branding); } `}</style>
			<MapComponent
				containerProps={{ className: "h-dvh relative" }}
				mapOptions={{
					center: data.embedMapCenter ? [data.embedMapCenter[0], data.embedMapCenter[1]] : undefined,
					style: "https://tiles.openfreemap.org/styles/liberty",
					zoom: data.embedMapCenter ? data.embedMapCenter[2] : undefined,
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
