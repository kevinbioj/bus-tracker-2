import { useQuery } from "@tanstack/react-query";
import type { Map as LeafletMap } from "leaflet";
import { CircleIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { MapContainer, TileLayer } from "react-leaflet";

import { GetLineQuery } from "~/api/lines";
import type { Vehicle } from "~/api/vehicles";
import ReactMoveableCircleMarker, { type MoveableCircleMarker } from "~/utils/moveable-circler-marker";

import "leaflet/dist/leaflet.css";
import { Link } from "react-router-dom";

type VehicleLiveProps = {
	vehicle: Vehicle;
};

export function VehicleLive({ vehicle }: Readonly<VehicleLiveProps>) {
	const mapRef = useRef<LeafletMap>(null);
	const markerRef = useRef<MoveableCircleMarker>(null);

	const { data: line } = useQuery(GetLineQuery(vehicle.activity.lineId));

	useEffect(() => {
		const map = mapRef.current;
		if (map === null || typeof vehicle.activity.position === "undefined") return;

		const { position } = vehicle.activity;
		map.flyTo({ lat: position.latitude, lng: position.longitude });
	}, [vehicle]);

	useEffect(() => {
		const marker = markerRef.current;
		if (marker === null) return;

		marker.setStyle({
			color: `#${line?.textColor ?? "FFFFFF"}`,
			fillColor: `#${line?.color ?? "000000"}`,
		});
	}, [line]);

	if (typeof vehicle.activity.position === "undefined") return null;

	const { position } = vehicle.activity;

	return (
		<Link
			className="block border border-border rounded-md shadow-lg min-w-64 h-32 lg:h-auto lg:aspect-square mt-3"
			to={`/#${vehicle.activity.markerId}`}
		>
			<style>{`
				.leafletContainer {
					border-radius: calc(var(--radius) - 2px);
				}
			`}</style>
			<MapContainer
				className="h-full rounded-md w-full"
				center={{ lat: position.latitude, lng: position.longitude }}
				zoom={11}
				zoomControl={false}
				doubleClickZoom={false}
				scrollWheelZoom={false}
				dragging={false}
				attributionControl={false}
				ref={mapRef}
			>
				<p className="absolute bg-white font-bold top-0.5 left-0.5 px-2 pt-0.5 rounded-md text-black z-400">
					<CircleIcon className="align-text-bottom animate-pulse fill-red-500 stroke-none size-4 inline" /> CLIQUER POUR
					VOIR EN DIRECT
				</p>
				<TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
				<ReactMoveableCircleMarker
					color={`#${line?.textColor ?? "FFFFFF"}`}
					duration={1000}
					bubblingMouseEvents={false}
					fillOpacity={1}
					fillColor={`#${line?.color ?? "000000"}`}
					position={{ lat: position.latitude, lng: position.longitude }}
					radius={8}
					ref={markerRef}
				/>
			</MapContainer>
		</Link>
	);
}
