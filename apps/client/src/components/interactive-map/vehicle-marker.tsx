import type { LatLngExpression } from "leaflet";
import { type RefObject, useCallback, useEffect, useMemo, useRef } from "react";
import { Popup } from "react-leaflet";

import type { DisposeableVehicleJourney } from "~/api/vehicle-journeys";
import { VehicleMarkerPopup } from "~/components/interactive-map/vehicle-marker-popup";
import { useLine } from "~/hooks/use-line";
import ReactMoveableCircleMarker, { type MoveableCircleMarker } from "~/utils/moveable-circler-marker";

const getNoise = () => (Math.random() - 0.5) * 0.000045;

const isTouchScreen = window.matchMedia("(pointer: coarse)").matches;

type VehicleMarkerProps = {
	activeMarker?: string;
	setActiveMarker: (marker: string) => void;
	journey: DisposeableVehicleJourney;
};

export function VehicleMarker({ activeMarker, setActiveMarker, journey }: VehicleMarkerProps) {
	const line = useLine(journey.networkId, journey.lineId);

	const position = useMemo(() => {
		const { latitude, longitude, type } = journey.position;
		if (type === "GPS") return [latitude, longitude];
		return [latitude + getNoise(), longitude + getNoise()];
	}, [journey]) satisfies LatLngExpression;

	const ref = useRef<MoveableCircleMarker>(null);
	useEffect(() => {
		if (ref.current === null) return;
		const circleMarker = ref.current;

		// @ts-expect-error Won't be typing it
		circleMarker.options.id = journey.id;

		if (circleMarker.options.color !== line?.textColor || circleMarker.options.fillColor !== line?.color) {
			ref.current.setStyle({
				color: line?.textColor ?? "#FFFFFF",
				fillColor: line?.color ?? "#000000",
			});
		}
	}, [journey, line]);

	const adjustPan = useCallback((ref: RefObject<MoveableCircleMarker>) => {
		if (ref.current === null) return;
		const { _popup } = ref.current as unknown as { _popup: { options: { autoPan: boolean }; _adjustPan: () => void } };
		_popup.options.autoPan = true;
		_popup._adjustPan();
		_popup.options.autoPan = false;
	}, []);

	return (
		<ReactMoveableCircleMarker
			color={line?.textColor ?? "#FFFFFF"}
			duration={1000}
			bubblingMouseEvents={false}
			eventHandlers={{
				click: (e) => {
					const target = e.target as MoveableCircleMarker;
					setActiveMarker(journey.id);
					if (!target.isPopupOpen()) target.openPopup();
					if (!isTouchScreen) {
						adjustPan(ref);
					}
				},
				moveend: (e) => {
					const target = e.target as MoveableCircleMarker;
					if (target.isPopupOpen()) {
						adjustPan(ref);
					}
				},
				mouseover: (e) => {
					if (isTouchScreen) return;
					const target = e.target as MoveableCircleMarker;
					if (activeMarker !== journey.id) {
						target.openPopup();
					}
				},
				mouseout: (e) => {
					if (isTouchScreen) return;
					const target = e.target as MoveableCircleMarker;
					if (activeMarker !== journey.id) {
						target.closePopup();
					}
				},
			}}
			fillOpacity={1}
			fillColor={line?.color ?? "#000000"}
			position={position}
			radius={8}
			ref={ref}
		>
			<Popup autoClose autoPan={false} closeButton={false} closeOnClick={false}>
				<VehicleMarkerPopup journey={journey} />
			</Popup>
		</ReactMoveableCircleMarker>
	);
}
