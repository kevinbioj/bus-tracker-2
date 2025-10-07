import type maplibregl from "maplibre-gl";
import { useEffect, useRef, useState } from "react";

import { useMap } from "~/adapters/maplibre-gl/map";
import { OnlineVehiclesSheetManagement } from "~/components/vehicles-map/online-vehicles/online-vehicles-sheet-management";
import { BusIcon } from "~/icons/means-of-transport";

export function OnlineControl() {
	const map = useMap();
	const activatorRef = useRef<HTMLDivElement>(null);
	const [open, setOpen] = useState(false);

	useEffect(() => {
		if (activatorRef.current === null) return;

		const control: maplibregl.IControl = {
			onAdd: () => activatorRef.current!,
			onRemove: () => void 0,
		};

		map.addControl(control, "top-left");
	}, [map]);

	return (
		<>
			<div className="maplibregl-ctrl maplibregl-ctrl-group" ref={activatorRef}>
				<button className="text-black" onClick={() => setOpen(true)} type="button">
					<BusIcon className="m-auto p-1" />
				</button>
			</div>
			<OnlineVehiclesSheetManagement open={open} setOpen={setOpen} />
		</>
	);
}
