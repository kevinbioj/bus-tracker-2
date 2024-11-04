"use client";

import dayjs from "dayjs";
import type { LatLngExpression } from "leaflet";
import { type RefObject, useCallback, useEffect, useMemo, useRef } from "react";
import { Popup } from "react-leaflet";
import { Satellite as SatelliteIcon } from "tabler-icons-react";
import { match } from "ts-pattern";
import type { DisposeableVehicleJourney } from "~/api/vehicle-journeys";

import { NextStops } from "~/components/interactive-map/next-stops";
import { VehicleGirouette } from "~/components/interactive-map/vehicle-girouette";
import ReactMoveableCircleMarker, { type MoveableCircleMarker } from "~/utils/moveable-circler-marker";

const getNoise = () => (Math.random() - 0.5) * 0.000045;

const isTouchScreen = window.matchMedia("(pointer: coarse)").matches;

type VehicleMarkerProps = {
	activeMarker?: string;
	setActiveMarker: (marker: string) => void;
	journey: DisposeableVehicleJourney;
};

export function VehicleMarker({ activeMarker, setActiveMarker, journey }: VehicleMarkerProps) {
	const updatePositionTime = useCallback(() => {
		const timestamp = dayjs(journey.position.recordedAt);
		if (dayjs().diff(timestamp, "hours") < 1) return timestamp.fromNow();
		return dayjs().diff(timestamp, "day") >= 1
			? `le ${timestamp.format("DD/MM à HH:mm:ss")}`
			: `à ${timestamp.format("HH:mm:ss")}`;
	}, [journey]);

	const position = useMemo(() => {
		const { latitude, longitude, type } = journey.position;
		if (type === "GPS") return [latitude, longitude];
		return [latitude + getNoise(), longitude + getNoise()];
	}, [journey]) satisfies LatLngExpression;

	const ref = useRef<MoveableCircleMarker>(null);
	useEffect(() => {
		if (ref.current === null) return;
		// @ts-expect-error This will be fine
		ref.current.options.id = journey.id;
		ref.current.setStyle({
			color: `#${journey.line?.textColor ?? "FFFFFF"}`,
			fillColor: `#${journey.line?.color ?? "000000"}`,
		});
	}, [journey]);

	const adjustPan = useCallback((ref: RefObject<MoveableCircleMarker>) => {
		if (ref.current === null) return;
		const { _popup } = ref.current as unknown as { _popup: { options: { autoPan: boolean }; _adjustPan: () => void } };
		_popup.options.autoPan = true;
		_popup._adjustPan();
		_popup.options.autoPan = false;
	}, []);

	// useEffect(() => {
	// 	setPositionTime(updatePositionTime());
	// 	const interval = setInterval(() => setPositionTime(updatePositionTime()), 3000);
	// 	return () => clearInterval(interval);
	// }, [journey, updatePositionTime]);

	// const ledColor = "YELLOW";
	const tooltipId = journey.id;

	return (
		<ReactMoveableCircleMarker
			color={`#${journey.line?.color ?? "FFFFFF"}`}
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
			fillColor={`#${journey.line?.color ?? "000000"}`}
			position={position}
			radius={8}
			ref={ref}
		>
			<Popup autoClose autoPan={false} closeButton={false} closeOnClick={false}>
				<div
					style={
						{
							/*width: `${girouetteWidth + 1}px`*/
						}
					}
				>
					<div className="border-[1px] border-neutral-800">
						<VehicleGirouette journey={journey} />
					</div>
					<div className="flex w-full flex-col font-[Achemine]">
						<div className="flex items-center justify-between gap-2 px-2 py-[1px]">
							<span className="text-center">{journey.vehicleRef ? `n°${journey.vehicleRef}` : "N/A"}</span>
							<SatelliteIcon
								className="h-5 w-5"
								color={match(journey.position.type)
									.with("GPS", () => "#00AA00")
									// .with("REALTIME", () => "#FF6600")
									.with("COMPUTED", () => "#DD0000")
									.exhaustive()}
								size={20}
							/>
						</div>
						{/* {journey.vehicle.id && journey.activityRegistered && (
							<Link
								className="bg-brand flex items-center justify-center gap-2 py-0.5 hover:bg-brand-hover"
								href={`/vehicles/${journey.source.toLowerCase()}/${journey.vehicle.id}`}
								target="_blank"
							>
								<BusIcon className="fill-white h-4 w-4" />
								<span className="font-[Achemine] font-bold flex text-sm text-white">Détails du véhicule</span>
							</Link>
						)} */}
						{typeof journey.calls !== "undefined" && <NextStops calls={journey.calls} tooltipId={tooltipId} />}
					</div>
				</div>
			</Popup>
		</ReactMoveableCircleMarker>
	);
}
