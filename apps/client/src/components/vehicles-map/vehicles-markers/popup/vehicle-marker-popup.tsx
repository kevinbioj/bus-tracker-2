import { useQuery } from "@tanstack/react-query";
import { LoaderCircleIcon } from "lucide-react";
import { useEffect } from "react";
import { useLocalStorage, useWindowSize } from "usehooks-ts";

import { useMapBounds } from "~/adapters/maplibre-gl/use-map-bounds";
import { GetVehicleJourneyMarkersQuery, GetVehicleJourneyQuery } from "~/api/vehicle-journeys";
import { CopyToClipboard } from "~/components/copy-to-clipboard";
import { Separator } from "~/components/ui/separator";
import { VehicleGirouette } from "~/components/vehicles-map/vehicles-markers/popup/vehicle-girouette";
import { VehicleInformation } from "~/components/vehicles-map/vehicles-markers/popup/vehicle-information";
import { VehicleNextStops } from "~/components/vehicles-map/vehicles-markers/popup/vehicle-next-stops";
import * as m from "~/paraglide/messages";

type VehicleDetailsProps = {
	embedMode?: boolean;
	journeyId: string;
};

/**
 * Rafraîchit le détail de la course dès que les marqueurs bougent. Isolé du rendu de la popup :
 * les bornes de la carte et l'horodatage des marqueurs ne décident de rien à l'écran, les observer
 * dans la popup la ferait rerendre à chaque déplacement de carte et à chaque rafraîchissement.
 */
function MarkersRefreshSync({ journeyId }: Readonly<{ journeyId: string }>) {
	const bounds = useMapBounds();
	const { dataUpdatedAt: markersUpdatedAt } = useQuery(GetVehicleJourneyMarkersQuery(bounds));
	// Même cache que la popup : aucune requête supplémentaire n'est émise.
	const { dataUpdatedAt: journeyUpdatedAt, refetch } = useQuery(GetVehicleJourneyQuery(journeyId, false));

	useEffect(() => {
		if (markersUpdatedAt > journeyUpdatedAt) {
			refetch({ cancelRefetch: false });
		}
	}, [markersUpdatedAt, journeyUpdatedAt, refetch]);

	return null;
}

export function VehicleMarkerPopup({ embedMode, journeyId }: Readonly<VehicleDetailsProps>) {
	const { width } = useWindowSize();

	const { data: journey, isError } = useQuery(GetVehicleJourneyQuery(journeyId, false));
	const popupWidth = journey?.girouette?.width ?? Math.min(width - 50, 384);

	const [showDebugInfos] = useLocalStorage("show-debug-info", false);

	return (
		<div className="font-[Achemine] leading-tight mb-1.5 text-[13px]" style={{ width: popupWidth }}>
			<MarkersRefreshSync journeyId={journeyId} />
			{isError ? (
				<p className="px-3 text-balance text-center">
					<span className="font-bold text-lg">{m.marker_missing_title()}</span>
					<br />
					<span className="text-muted-foreground">{m.marker_missing_description()}</span>
				</p>
			) : journey !== undefined ? (
				<>
					<VehicleGirouette journey={journey} width={popupWidth} />
					<VehicleInformation disableLinks={embedMode} journey={journey} />
					{journey.calls !== undefined && <VehicleNextStops calls={journey.calls} tooltipId={journey.id} />}
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
