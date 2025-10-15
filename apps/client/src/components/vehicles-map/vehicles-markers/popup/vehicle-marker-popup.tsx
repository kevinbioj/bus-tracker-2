import { useQuery } from "@tanstack/react-query";
import { LoaderCircleIcon } from "lucide-react";
import { useEffect } from "react";
import { useLocalStorage, useScreen } from "usehooks-ts";

import { useMapBounds } from "~/adapters/maplibre-gl/use-map-bounds";
import { GetVehicleJourneyMarkersQuery, GetVehicleJourneyQuery } from "~/api/vehicle-journeys";
import { CopyToClipboard } from "~/components/ui/copy-to-clipboard";
import { Separator } from "~/components/ui/separator";
import { VehicleGirouette } from "~/components/vehicles-map/vehicles-markers/popup/vehicle-girouette";
import { VehicleInformation } from "~/components/vehicles-map/vehicles-markers/popup/vehicle-information";
import { VehicleNextStops } from "~/components/vehicles-map/vehicles-markers/popup/vehicle-next-stops";

type VehicleDetailsProps = {
	journeyId: string;
};

export function VehicleMarkerPopup({ journeyId }: Readonly<VehicleDetailsProps>) {
	const bounds = useMapBounds();
	const { width } = useScreen();

	const { dataUpdatedAt: markersUpdatedAt } = useQuery(GetVehicleJourneyMarkersQuery(bounds));
	const {
		data: journey,
		dataUpdatedAt: journeyUpdatedAt,
		isError,
		refetch,
	} = useQuery(GetVehicleJourneyQuery(journeyId, false));
	const popupWidth = journey?.girouette?.width ?? Math.min(width - 50, 384);

	const [showDebugInfos] = useLocalStorage("show-debug-info", false);

	// refetch popup data whenever markers move
	useEffect(() => {
		if (markersUpdatedAt > journeyUpdatedAt) {
			refetch({ cancelRefetch: false });
		}
	}, [markersUpdatedAt, journeyUpdatedAt, refetch]);

	return (
		<div className="font-[Achemine] leading-tight mb-1.5 text-[13px]" style={{ width: popupWidth }}>
			{isError ? (
				<p className="px-3 text-balance text-center">
					<span className="font-bold text-lg">☠️ Entrée introuvable</span>
					<br />
					<span className="text-muted-foreground">
						Cette entrée n'est plus d'actualité, elle devrait disparaitre au prochain rafraichissement de la carte.
					</span>
				</p>
			) : typeof journey !== "undefined" ? (
				<>
					<VehicleGirouette journey={journey} width={popupWidth} />
					<VehicleInformation journey={journey} />
					{typeof journey.calls !== "undefined" ? (
						<VehicleNextStops calls={journey.calls} tooltipId={journey.id} />
					) : null}
					{showDebugInfos && (
						<>
							<Separator />
							<div className="flex items-center gap-0.5 px-1 pt-0.5 -mb-2">
								<span>ID</span>
								<pre className="align-text-bottom inline-block bg-neutral-200 dark:bg-neutral-700 text-ellipsis overflow-hidden text-nowrap">
									{journeyId}
								</pre>
								<CopyToClipboard data={journeyId} />
							</div>
						</>
					)}
				</>
			) : (
				<LoaderCircleIcon className="animate-spin m-auto p-1" size={64} />
			)}
		</div>
	);
}
