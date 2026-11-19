import { useEffect } from "react";

const CLOSE_VEHICLE_POPUP_EVENT = "bus-tracker:close-vehicle-popup";

export function requestVehiclePopupClose() {
	window.dispatchEvent(new Event(CLOSE_VEHICLE_POPUP_EVENT));
}

export function CloseVehiclePopupOnRequest({ onClose }: Readonly<{ onClose: () => void }>) {
	useEffect(() => {
		window.addEventListener(CLOSE_VEHICLE_POPUP_EVENT, onClose);
		return () => window.removeEventListener(CLOSE_VEHICLE_POPUP_EVENT, onClose);
	}, [onClose]);

	return null;
}
