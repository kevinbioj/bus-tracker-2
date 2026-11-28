import { MapPinnedIcon } from "lucide-react";
import type { IControl } from "maplibre-gl";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { useMap } from "~/adapters/maplibre-gl/map";
import { useStopSelection } from "~/components/vehicles-map/stops-markers/stop-selection";
import * as m from "~/paraglide/messages";

function placeAfterGeolocateControl(container: HTMLElement) {
	const parent = container.parentElement;
	if (parent === null) return true;

	const geolocateGroup = parent.querySelector(":scope > .maplibregl-ctrl-group:has(.maplibregl-ctrl-geolocate)");
	if (geolocateGroup === null) return false;
	if (geolocateGroup.nextElementSibling !== container) geolocateGroup.after(container);
	return true;
}

export function NearbyDeparturesButton() {
	const map = useMap();
	const [container, setContainer] = useState<HTMLDivElement | null>(null);
	const { nearby, openNearby, closeNearby } = useStopSelection();

	useEffect(() => {
		setContainer(document.createElement("div"));
	}, []);

	useEffect(() => {
		if (container === null) return;

		container.classList.add("maplibregl-ctrl", "maplibregl-ctrl-group", "map-default-control");

		const control: IControl = {
			onAdd: () => container,
			onRemove: () => container.remove(),
		};

		map.addControl(control, "top-right");

		const parent = container.parentElement;
		let observer: MutationObserver | undefined;
		if (parent !== null && !placeAfterGeolocateControl(container)) {
			observer = new MutationObserver(() => {
				if (placeAfterGeolocateControl(container)) observer?.disconnect();
			});
			observer.observe(parent, { childList: true });
		}

		return () => {
			observer?.disconnect();
			map.removeControl(control);
		};
	}, [container, map]);

	return (
		container !== null &&
		createPortal(
			<button
				aria-label={m.nearby_departures_open()}
				aria-pressed={nearby}
				className="text-card-foreground aria-pressed:text-branding"
				title={m.nearby_departures_open()}
				type="button"
				onClick={nearby ? closeNearby : openNearby}
			>
				<MapPinnedIcon className="m-auto p-0.5" strokeWidth={2.5} />
			</button>,
			container,
		)
	);
}
