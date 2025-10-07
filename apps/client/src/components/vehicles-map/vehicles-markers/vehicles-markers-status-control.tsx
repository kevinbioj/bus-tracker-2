import { RefreshCwIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { useMap } from "~/adapters/maplibre-gl/map";
import { cn } from "~/utils/utils";

type VehiclesMarkersStatusControlProps = {
	loading: boolean;
	onClick?: () => void;
};

export function VehiclesMarkersStatusControl({ loading, onClick }: VehiclesMarkersStatusControlProps) {
	const map = useMap();
	const controlRef = useRef<HTMLDivElement>(document.createElement("div"));

	useEffect(() => {
		if (controlRef.current === null) return;

		controlRef.current.classList.add("maplibregl-ctrl", "maplibregl-ctrl-group");

		const control: maplibregl.IControl = {
			onAdd: () => controlRef.current!,
			onRemove: () => void 0,
		};

		map.addControl(control, "top-right");
		return () => void map.removeControl(control);
	}, [map]);

	return createPortal(
		<button
			className="text-black"
			disabled={typeof onClick === "undefined"}
			onClick={onClick}
			title={loading ? "Rafraichissement en cours..." : "Rafraichir les données"}
			type="button"
		>
			<RefreshCwIcon className={cn("m-auto p-0.5", loading && "animate-spin")} strokeWidth={3} />
		</button>,
		controlRef.current,
	);
}
