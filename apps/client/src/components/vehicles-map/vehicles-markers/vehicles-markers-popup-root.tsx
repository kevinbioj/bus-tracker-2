import type maplibregl from "maplibre-gl";

import { GeojsonPopup } from "~/adapters/maplibre-gl/geojson-popup";
import { VehicleMarkerPopup } from "~/components/vehicles-map/vehicles-markers/popup/vehicle-marker-popup";
import { JumpTo } from "~/components/vehicles-map/vehicles-markers/vehicles-markers-jump-to";

const popupOptions: maplibregl.PopupOptions = {
	anchor: "bottom",
	closeButton: false,
	closeOnClick: false,
	maxWidth: "none",
	offset: 2,
};

type VehiclesMarkersPopupRootProps = {
	layer: maplibregl.StyleLayer;
};

export function VehiclesMarkersPopupRoot({ layer }: VehiclesMarkersPopupRootProps) {
	return (
		<GeojsonPopup layer={layer} popupOptions={popupOptions}>
			{({ activeFeature, openPopup }) => {
				if (localStorage.getItem("active-feature") !== activeFeature?.id) {
					if (activeFeature !== null) localStorage.setItem("active-feature", activeFeature.id);
					else localStorage.removeItem("active-feature");
				}

				return (
					<>
						{activeFeature !== null && <VehicleMarkerPopup key={activeFeature.id} journeyId={activeFeature.id} />}
						<JumpTo openPopup={openPopup} />
					</>
				);
			}}
		</GeojsonPopup>
	);
}
