import type { LatLngExpression } from "leaflet";
import { type RefObject, useCallback, useEffect, useMemo, useRef } from "react";
import { Popup } from "react-leaflet";

import type { VehicleJourneyMarker } from "~/api/vehicle-journeys";
import { VehicleMarkerPopup } from "~/components/interactive-map/vehicles/vehicle-marker-popup";
import ReactMoveableCircleMarker, { type MoveableCircleMarker } from "~/utils/moveable-circler-marker";

const getNoise = () => (Math.random() - 0.5) * 0.000045;

const isTouchScreen = window.matchMedia("(pointer: coarse)").matches;

type VehicleMarkerProps = {
	activeMarker?: string;
	setActiveMarker: (marker: string) => void;
	marker: VehicleJourneyMarker;
};

export function VehicleMarker({ activeMarker, setActiveMarker, marker }: Readonly<VehicleMarkerProps>) {
	const position = useMemo(() => {
		const { latitude, longitude, type } = marker.position;
		if (type === "GPS") return [latitude, longitude];
		return [latitude + getNoise(), longitude + getNoise()];
	}, [marker]) satisfies LatLngExpression;

	const ref = useRef<MoveableCircleMarker>(null);
	useEffect(() => {
		if (ref.current === null) return;
		const circleMarker = ref.current;

		// @ts-expect-error Won't be typing it
		circleMarker.options.id = marker.id;

		if (circleMarker.options.color !== marker.color || circleMarker.options.fillColor !== marker.fillColor) {
			ref.current.setStyle({
				color: marker.color ?? "#FFFFFF",
				fillColor: marker.fillColor ?? "#000000",
			});
		}
	}, [marker]);

	useEffect(() => {
		if (ref.current === null) return;

		if (activeMarker === marker.id) {
			const target = ref.current;
			if (!target.isPopupOpen()) target.openPopup();
			if (!isTouchScreen) {
				adjustPan(ref);
			}
		}
	}, [activeMarker, marker]);

	const adjustPan = useCallback((ref: RefObject<MoveableCircleMarker | null>) => {
		if (ref.current === null) return;
		const { _popup } = ref.current as unknown as { _popup: { options: { autoPan: boolean }; _adjustPan: () => void } };
		_popup.options.autoPan = true;
		_popup._adjustPan();
		_popup.options.autoPan = false;
	}, []);

	const updatePopup = () => {
		if (ref.current === null) return;

		const popup = ref.current.getPopup();
		if (popup) {
			popup.update();
		}
	};

	return (
		<ReactMoveableCircleMarker
			className="relative"
			color={marker.color ?? "#FFFFFF"}
			duration={1000}
			bubblingMouseEvents={false}
			eventHandlers={{
				click: () => {
					setActiveMarker(marker.id);
				},
				moveend: (e) => {
					const target = e.target as MoveableCircleMarker;
					if (target.isPopupOpen()) {
						adjustPan(ref);
					}
				},
				mouseover: async (e) => {
					if (isTouchScreen) return;
					const target = e.target as MoveableCircleMarker;
					if (activeMarker !== marker.id) {
						target.openPopup();
					}
				},
				mouseout: (e) => {
					if (isTouchScreen) return;
					const target = e.target as MoveableCircleMarker;
					if (activeMarker !== marker.id) {
						target.closePopup();
					}
				},
			}}
			fillOpacity={1}
			fillColor={marker.fillColor ?? "#000000"}
			position={position}
			radius={8}
			ref={ref}
		>
			<Popup autoClose autoPan={false} closeButton={false} closeOnClick={false}>
				<VehicleMarkerPopup journeyId={marker.id} position={position} updatePopup={updatePopup} />
			</Popup>
		</ReactMoveableCircleMarker>
	);
}
