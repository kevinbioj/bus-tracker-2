import { LocateControl as LeafletLocateControl } from "leaflet.locatecontrol";
import "leaflet.locatecontrol/dist/L.Control.Locate.min.css";
import { useEffect } from "react";
import { useMap } from "react-leaflet";
import { useLocalStorage } from "usehooks-ts";

export function LocateControl() {
	const map = useMap();
	const [geolocateOnStart] = useLocalStorage("geolocate-on-start", false);

	useEffect(() => {
		const locateInstance = new LeafletLocateControl({
			showPopup: false,
			strings: { title: "Me géolocaliser" },
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
