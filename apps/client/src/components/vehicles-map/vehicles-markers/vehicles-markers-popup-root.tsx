import type { PopupOptions, StyleLayer } from "maplibre-gl";
import { useEffect } from "react";

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

/**
 * Remonte la course active hors du rendu de la popup : la prévenir depuis la fonction de rendu
 * reviendrait à modifier l'état d'un composant parent pendant son rendu.
 */
function ActiveJourneyReporter({
	journeyId,
	onChange,
}: Readonly<{ journeyId: string | null; onChange: (journeyId: string | null) => void }>) {
	useEffect(() => {
		onChange(journeyId);
	}, [journeyId, onChange]);

	return null;
}

type VehiclesMarkersPopupRootProps = {
	embedMode?: boolean;
	layer: StyleLayer;
	lineId?: number;
	onActiveJourneyChange: (journeyId: string | null) => void;
};

export function VehiclesMarkersPopupRoot({
	embedMode,
	layer,
	lineId,
	onActiveJourneyChange,
}: VehiclesMarkersPopupRootProps) {
	return (
		<GeojsonPopup layer={layer} popupOptions={popupOptions}>
			{({ activeFeature, openPopup }) => {
				if (localStorage.getItem("active-feature") !== activeFeature?.id) {
					if (activeFeature !== null) localStorage.setItem("active-feature", activeFeature.id);
					else localStorage.removeItem("active-feature");
				}

				return (
					<>
						<ActiveJourneyReporter journeyId={activeFeature?.id ?? null} onChange={onActiveJourneyChange} />
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
