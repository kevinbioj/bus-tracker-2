// @ts-expect-error Because @types/leaflet.locatecontrol is off
import { locate } from "leaflet.locatecontrol";
import "leaflet.locatecontrol/dist/L.Control.Locate.min.css";
import { useEffect } from "react";
import { useMap } from "react-leaflet";
import { useLocalStorage } from "usehooks-ts";

export function LocateControl() {
	const map = useMap();
	const [geolocateOnStart] = useLocalStorage("geolocate-on-start", false);

	useEffect(() => {
		const locateInstance: L.Control.Locate = locate({
			showPopup: false,
			strings: { title: "Me géolocaliser" },
			locateOptions: { maxZoom: 13 },
		}).addTo(map);

		if (geolocateOnStart) {
			locateInstance.start();
		}

		return () => {
			locateInstance.stop();
			locateInstance.remove();
		};
	}, [geolocateOnStart, map]);

	return null;
}
