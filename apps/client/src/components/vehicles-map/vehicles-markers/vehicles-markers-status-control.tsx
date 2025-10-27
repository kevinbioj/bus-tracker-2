import { RefreshCwIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { useMap } from "~/adapters/maplibre-gl/map";
import { cn } from "~/utils/utils";

type VehiclesMarkersStatusControlProps = {
	loading: boolean;
	onClick?: () => void;
};

export function VehiclesMarkersStatusControl({ loading, onClick }: VehiclesMarkersStatusControlProps) {
	const map = useMap();
	const [controlRef, setControlRef] = useState<HTMLDivElement | null>(null);

	useEffect(() => {
		setControlRef(document.createElement("div"));
	}, []);

	useEffect(() => {
		if (controlRef === null) return;

		controlRef.classList.add("maplibregl-ctrl", "maplibregl-ctrl-group");

		const control: maplibregl.IControl = {
			onAdd: () => controlRef,
			onRemove: () => void 0,
		};

		map.addControl(control, "top-right");
		return () => void map.removeControl(control);
	}, [controlRef, map]);

	return (
		controlRef !== null &&
		createPortal(
			<button
				className="text-black"
				disabled={typeof onClick === "undefined"}
				onClick={onClick}
				title={loading ? "Rafraichissement en cours..." : "Rafraichir les données"}
				type="button"
			>
				<RefreshCwIcon className={cn("m-auto p-0.5", loading && "animate-spin")} strokeWidth={3} />
			</button>,
			controlRef,
		)
	);
}
