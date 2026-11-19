import { SatelliteDishIcon } from "lucide-react";
import { type RefObject, useEffect, useState } from "react";

import {
	markVehiclePopupTourSeen,
	startVehiclePopupTour,
	useOnboardingState,
} from "~/components/onboarding/onboarding-state";
import { skippedOutcome, Tour, type TourOutcome, type TourStep } from "~/components/onboarding/tour";
import { InformationChip } from "~/components/vehicles-map/vehicles-markers/popup/information-chip";
import { positionIconDetails } from "~/components/vehicles-map/vehicles-markers/popup/vehicle-information";
import * as m from "~/paraglide/messages";
import { posthog } from "~/utils/posthog";

const START_DELAY_MS = 600;

const positionLegend = [
	{ details: positionIconDetails.GPS, description: m.onboarding_popup_position_gps },
	{ details: positionIconDetails.ESTIMATED, description: m.onboarding_popup_position_estimated },
	{ details: positionIconDetails.SCHEDULED, description: m.onboarding_popup_position_scheduled },
];

function PositionLegend() {
	return (
		<ul className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1.5">
			{positionLegend.map(({ details, description }) => (
				<li className="col-span-2 grid grid-cols-subgrid items-start" key={details.title()}>
					<InformationChip
						className={`w-fit justify-self-start ${details.chipClasses}`}
						icon={<SatelliteDishIcon className="size-full" />}
						label={details.label()}
						role="img"
						size="md"
					/>
					<span className="leading-snug">{description()}</span>
				</li>
			))}
		</ul>
	);
}

function findVisible(root: HTMLElement, selector: string) {
	return Array.from(root.querySelectorAll(selector)).find(
		(element) => element.closest('[aria-hidden="true"]') === null,
	);
}

export function buildVehiclePopupSteps(root: HTMLElement, canFilterLine: boolean, showcase = false) {
	const routeNumber = canFilterLine ? findVisible(root, '[data-slot="girouette-route-number"]') : undefined;
	const network = findVisible(root, '[data-onboarding="network"]');
	const chips = findVisible(root, '[data-slot="information-chips"]');
	const position = findVisible(root, '[data-onboarding="position"]');
	const spotlight = root.closest(".maplibregl-popup-content") ?? root;

	const steps: (TourStep | false)[] = [
		routeNumber !== undefined && {
			id: "line",
			anchor: routeNumber,
			side: "top",
			align: "start",
			title: showcase ? m.onboarding_showcase_line_title() : m.onboarding_popup_line_title(),
			body: showcase ? m.onboarding_showcase_line_body() : m.onboarding_popup_line_body(),
		},
		network !== undefined && {
			id: "network",
			anchor: network,
			side: "bottom",
			align: "start",
			title: m.onboarding_popup_network_title(),
			body: m.onboarding_popup_network_body(),
		},
		chips !== undefined && {
			id: "chips",
			anchor: chips,
			side: "bottom",
			align: "end",
			title: m.onboarding_popup_chips_title(),
			body: m.onboarding_popup_chips_body(),
		},
		position !== undefined && {
			id: "position",
			anchor: position,
			side: "bottom",
			align: "end",
			title: m.onboarding_popup_position_title(),
			body: m.onboarding_popup_position_body(),
			content: <PositionLegend />,
		},
	];

	return steps.filter((step) => step !== false).map((step) => ({ ...step, spotlight }));
}

type VehiclePopupTourProps = {
	canFilterLine: boolean;
	rootRef: RefObject<HTMLElement | null>;
};

export function VehiclePopupTour({ canFilterLine, rootRef }: Readonly<VehiclePopupTourProps>) {
	const { mapTour, mapTourActive, vehiclePopupTour } = useOnboardingState();
	const [tour, setTour] = useState<{ steps: TourStep[]; index: number; backdrop: Element | undefined } | null>(null);

	useEffect(() => {
		if (!vehiclePopupTour || mapTour !== null || mapTourActive) return;

		const timeout = window.setTimeout(() => {
			const root = rootRef.current;
			if (root === null) return;

			const steps = buildVehiclePopupSteps(root, canFilterLine);
			if (steps.length === 0) return;

			startVehiclePopupTour();
			setTour({ steps, index: 0, backdrop: root.closest(".maplibregl-map") ?? undefined });
			posthog.capture("onboarding_shown", { tour: "vehicle-popup", steps: steps.map((step) => step.id) });
		}, START_DELAY_MS);

		return () => window.clearTimeout(timeout);
	}, [canFilterLine, mapTour, mapTourActive, rootRef, vehiclePopupTour]);

	if (tour === null) return null;

	const finish = (outcome: TourOutcome) => {
		markVehiclePopupTourSeen();
		posthog.capture("onboarding_finished", {
			tour: "vehicle-popup",
			outcome,
			step: tour.steps[tour.index]?.id,
			step_index: tour.index,
			step_count: tour.steps.length,
		});
		setTour(null);
	};

	return (
		<Tour
			backdrop={tour.backdrop}
			doneLabel={m.onboarding_got_it()}
			index={tour.index}
			steps={tour.steps}
			onNext={() => {
				markVehiclePopupTourSeen();
				if (tour.index < tour.steps.length - 1) setTour({ ...tour, index: tour.index + 1 });
				else finish("completed");
			}}
			onSkip={() => finish(skippedOutcome(tour.index))}
		/>
	);
}
