import type { PopupOptions, StyleLayer } from "maplibre-gl";

import { GeojsonPopup } from "~/adapters/maplibre-gl/geojson-popup";
import { VehiclePath } from "~/components/vehicles-map/vehicle-path";
import { VehicleMarkerPopup } from "~/components/vehicles-map/vehicles-markers/popup/vehicle-marker-popup";
import { JumpTo } from "~/components/vehicles-map/vehicles-markers/vehicles-markers-jump-to";

const popupOptions: PopupOptions = {
	anchor: "bottom",
	closeButton: false,
	closeOnClick: false,
	maxWidth: "none",
	offset: 2,
};

type VehiclesMarkersPopupRootProps = {
	embedMode?: boolean;
	layer: StyleLayer;
	lineId?: number;
};

export function VehiclesMarkersPopupRoot({ embedMode, layer, lineId }: VehiclesMarkersPopupRootProps) {
	return (
		<GeojsonPopup layer={layer} popupOptions={popupOptions}>
			{({ activeFeature, openPopup }) => {
				if (localStorage.getItem("active-feature") !== activeFeature?.id) {
					if (activeFeature !== null) localStorage.setItem("active-feature", activeFeature.id);
					else localStorage.removeItem("active-feature");
				}

				return (
					<>
						{activeFeature !== null && (
							<VehicleMarkerPopup embedMode={embedMode} key={activeFeature.id} journeyId={activeFeature.id} />
						)}
						<VehiclePath journeyId={activeFeature?.id} lineId={lineId} />
						<JumpTo openPopup={openPopup} />
					</>
				);
			}}
		</GeojsonPopup>
	);
}
