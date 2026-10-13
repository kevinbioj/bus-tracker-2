import { useQuery } from "@tanstack/react-query";
import { LoaderCircleIcon } from "lucide-react";
import { type KeyboardEvent, useEffect, useRef } from "react";
import { useLocalStorage, useWindowSize } from "usehooks-ts";

import { GetVehicleJourneyQuery } from "~/api/vehicle-journeys";
import { CopyToClipboard } from "~/components/copy-to-clipboard";
import { Separator } from "~/components/ui/separator";
import { useDisplayNextCalls } from "~/components/vehicles-map/display-next-calls";
import { VehicleGirouette } from "~/components/vehicles-map/vehicles-markers/popup/vehicle-girouette";
import { VehicleInformation } from "~/components/vehicles-map/vehicles-markers/popup/vehicle-information";
import { VehicleNextStops } from "~/components/vehicles-map/vehicles-markers/popup/vehicle-next-stops";
import { useLine } from "~/hooks/use-line";
import * as m from "~/paraglide/messages";

type VehicleDetailsProps = {
	autoFocus?: boolean;
	embedMode?: boolean;
	journeyId: string;
	onClose: () => void;
};

export function VehicleMarkerPopup({ autoFocus, embedMode, journeyId, onClose }: Readonly<VehicleDetailsProps>) {
	const { width } = useWindowSize();
	const rootRef = useRef<HTMLDivElement>(null);
	const returnFocusRef = useRef<HTMLElement | null>(null);

	const { data: journey, isError } = useQuery(GetVehicleJourneyQuery(journeyId, false));
	const popupWidth = journey?.girouette?.width ?? Math.min(width - 50, 384);
	const line = useLine(journey?.networkId, journey?.lineId);

	const [displayNextCalls] = useDisplayNextCalls();
	const [showDebugInfos] = useLocalStorage("show-debug-info", false);

	const loaded = journey !== undefined || isError;

	const label =
		journey === undefined
			? undefined
			: [
					journey.vehicle ? m.marker_popup_vehicle({ number: journey.vehicle.number }) : undefined,
					line ? (line.girouetteNumber ? line.number : m.network_lines_label({ lineNumber: line.number })) : undefined,
					m.marker_popup_towards({
						destination:
							journey.destination ??
							journey.calls?.[journey.calls.length - 1]?.stopName ??
							m.marker_destination_unknown(),
					}),
				]
					.filter(Boolean)
					.join(", ");

	useEffect(() => {
		const root = rootRef.current;
		if (!autoFocus || !loaded || root === null || root.contains(document.activeElement)) return;

		returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		root.focus({ preventScroll: true });
	}, [autoFocus, loaded]);

	useEffect(() => {
		const root = rootRef.current;
		return () => {
			const returnFocus = returnFocusRef.current;
			if (returnFocus === null || !returnFocus.isConnected) return;
			if (document.activeElement === document.body || root?.contains(document.activeElement)) {
				returnFocus.focus({ preventScroll: true });
			}
		};
	}, []);

	const onKeyDown = (event: KeyboardEvent) => {
		if (event.key !== "Escape") return;
		event.stopPropagation();
		onClose();
	};

	return (
		<div
			aria-label={label}
			className="font-[Achemine] leading-tight mb-1.5 text-[13px] outline-none"
			onKeyDown={onKeyDown}
			ref={rootRef}
			role="dialog"
			style={{ width: popupWidth }}
			tabIndex={-1}
		>
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
					{displayNextCalls && journey.calls !== undefined && (
						<VehicleNextStops addedJourney={journey.isAdded} calls={journey.calls} tooltipId={journey.id} />
					)}
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
