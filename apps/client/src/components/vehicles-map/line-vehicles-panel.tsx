import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { HistoryIcon, LocateIcon } from "lucide-react";
import { useQueryState } from "nuqs";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";

import { useMap } from "~/adapters/maplibre-gl/map";
import { GetLineOnlineVehiclesQuery } from "~/api/lines";
import { Button } from "~/components/ui/button";

type LineVehiclesPanelProps = {
	lineId: number;
	timezone?: string;
};

export function LineVehiclesPanel({ lineId, timezone }: LineVehiclesPanelProps) {
	const map = useMap();
	const containerRef = useRef(document.createElement("div"));
	const { data: vehicles } = useQuery(GetLineOnlineVehiclesQuery(lineId));
	const [, setMarkerId] = useQueryState("marker-id");

	useEffect(() => {
		const container = containerRef.current;
		container.className = "maplibregl-ctrl maplibregl-ctrl-group font-sans";

		const control = {
			onAdd: () => container,
			onRemove: () => void 0,
		};

		map.addControl(control, "bottom-right");
		return () => {
			map.removeControl(control);
		};
	}, [map]);

	const identifiedVehicles =
		vehicles
			?.filter((v) => v.activity.status === "online" && v.activity.markerId !== undefined)
			.sort((a, b) => a.number.localeCompare(b.number)) ?? [];

	return createPortal(
		<div className="bg-background/95 backdrop-blur-sm rounded-sm shadow-lg border overflow-hidden w-96 max-w-[calc(100dvw-20px)]">
			<div className="px-2 py-2 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wide">
				Véhicules en ligne ({identifiedVehicles.length})
			</div>
			<ul className="max-h-52 overflow-y-auto divide-y">
				{identifiedVehicles.map((vehicle) => (
					<li key={vehicle.id} className="flex items-center gap-1 px-2 py-1">
						<div className="flex-1 min-w-0">
							<div className="text-sm font-medium truncate">
								<span className="font-bold">n°{vehicle.number}</span>
								{vehicle.activity.since && (
									<span className="ml-1.5 text-xs text-muted-foreground tabular-nums">
										depuis {dayjs(vehicle.activity.since).tz(timezone).format("HH:mm")}
									</span>
								)}
							</div>
							{vehicle.designation && <div className="text-wrap">{vehicle.designation}</div>}
						</div>
						<Button
							className="size-7 shrink-0"
							size="icon"
							title="Localiser sur la carte"
							type="button"
							variant="ghost"
							onClick={() => setMarkerId(vehicle.activity.markerId!)}
						>
							<LocateIcon className="size-4 m-auto" />
						</Button>
						<Button asChild className="size-7 shrink-0" size="icon" variant="ghost">
							<Link title="Voir l'historique" to={`/data/vehicles/${vehicle.id}`}>
								<HistoryIcon className="size-4 m-auto" />
							</Link>
						</Button>
					</li>
				))}
			</ul>
		</div>,
		containerRef.current,
	);
}
