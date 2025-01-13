import L from "leaflet";
import React, { useEffect } from "react";
import { useMap } from "react-leaflet";

import { OnlineSheet } from "~/components/interactive-map/online/online-sheet";

export function OnlineControl() {
	// biome-ignore lint/suspicious/noExplicitAny: to be properly typed later...
	const [portalRoot, setPortalRoot] = React.useState<any>(document.createElement("div"));
	const positionClass = "leaflet-top leaflet-left";
	const controlContainerRef = React.createRef<HTMLDivElement>();
	const map = useMap();

	useEffect(() => {
		if (controlContainerRef.current !== null) {
			L.DomEvent.disableClickPropagation(controlContainerRef.current);
			L.DomEvent.disableScrollPropagation(controlContainerRef.current);
		}
	}, [controlContainerRef]);

	useEffect(() => {
		const mapContainer = map.getContainer();
		const targetDiv = mapContainer.getElementsByClassName(positionClass);
		setPortalRoot(targetDiv[0]);
	}, [map]);

	useEffect(() => {
		if (portalRoot !== null) {
			portalRoot.append(controlContainerRef.current);
		}
	}, [portalRoot, controlContainerRef]);

	return (
		<div ref={controlContainerRef} className="leaflet-control-locate leaflet-control leaflet-bar">
			<OnlineSheet />
		</div>
	);
}
