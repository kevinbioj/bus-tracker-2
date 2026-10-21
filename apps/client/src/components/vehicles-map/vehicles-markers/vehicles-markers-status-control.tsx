import { RadioIcon, RefreshCwIcon } from "lucide-react";
import type { IControl } from "maplibre-gl";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { useMap } from "~/adapters/maplibre-gl/map";
import * as m from "~/paraglide/messages";
import { cn } from "~/utils/cn";

type VehiclesMarkersStatusControlProps = {
	live?: boolean;
	loading: boolean;
	onClick?: () => void;
};

export function VehiclesMarkersStatusControl({ live, loading, onClick }: VehiclesMarkersStatusControlProps) {
	const map = useMap();
	const [controlRef, setControlRef] = useState<HTMLDivElement | null>(null);

	useEffect(() => {
		setControlRef(document.createElement("div"));
	}, []);

	useEffect(() => {
		if (controlRef === null) return;

		controlRef.classList.add("maplibregl-ctrl", "maplibregl-ctrl-group");

		const control: IControl = {
			onAdd: () => controlRef,
			onRemove: () => void 0,
		};

		map.addControl(control, "top-right");
		return () => {
			map.removeControl(control);
		};
	}, [controlRef, map]);

	return (
		controlRef !== null &&
		createPortal(
			<button
				className="text-black"
				disabled={onClick === undefined}
				onClick={onClick}
				title={live ? m.map_realtime_live() : loading ? m.map_refresh_loading() : m.map_refresh_data()}
				type="button"
			>
				{live ? (
					<RadioIcon className="m-auto p-0.5" strokeWidth={3} />
				) : (
					<RefreshCwIcon className={cn("m-auto p-0.5", loading && "animate-spin")} strokeWidth={3} />
				)}
			</button>,
			controlRef,
		)
	);
}
