import { parseAsInteger, useQueryState } from "nuqs";
import { useLayoutEffect, useRef, useState } from "react";

import type { DisposeableVehicleJourney } from "~/api/vehicle-journeys";
import {
	Girouette,
	type GirouetteData,
	getAutoOutlineColor,
} from "~/components/vehicles-map/vehicles-markers/popup/girouette";
import { useLine } from "~/hooks/use-line";
import * as m from "~/paraglide/messages";

const guessFont = (text: string) => {
	if (text.length <= "KKKKKKKKKKKKKKKKK".length) return "1508SUPX";
	if (text.length <= "FFFFFFFFFFFFFFFFFFFF".length) return "1507SUPX";
	return "1407SUPX";
};

const shouldScroll = (text: string) => text.length >= "FFFFFFFFFFFFFFFFFFFFFFF".length;

/** Temps d'extinction de la girouette lorsqu'elle change de destination, en millisecondes. */
const refreshDuration = 1500;

/**
 * Éteint la girouette le temps qu'elle « charge » sa nouvelle destination, comme
 * le ferait une vraie. Le premier affichage d'une course, comme le passage à une
 * autre course, reste immédiat : seul un changement en cours de route rallume la
 * girouette après coup.
 */
function useRefreshing(journeyId: string, pages: GirouetteData["pages"]) {
	const signature = JSON.stringify(pages ?? []);
	const displayed = useRef<{ journeyId: string; signature: string } | null>(null);
	const [refreshing, setRefreshing] = useState(false);

	// Avant peinture, pour que la nouvelle destination ne s'affiche jamais l'espace
	// d'une image avant l'extinction.
	useLayoutEffect(() => {
		const previous = displayed.current;
		displayed.current = { journeyId, signature };

		// Premier affichage, passage à une autre course, ou remontage à contenu
		// identique : il n'y a rien à recharger.
		if (previous === null || previous.journeyId !== journeyId || previous.signature === signature) {
			setRefreshing(false);
			return;
		}

		setRefreshing(true);
		const timeout = setTimeout(() => setRefreshing(false), refreshDuration);
		return () => clearTimeout(timeout);
	}, [journeyId, signature]);

	return refreshing;
}

type VehicleGirouetteProps = {
	journey: DisposeableVehicleJourney;
	width: number;
};

export function VehicleGirouette({ journey, width }: Readonly<VehicleGirouetteProps>) {
	const girouette = journey.girouette;
	const [, setLineId] = useQueryState("line-id", parseAsInteger);
	const [, setNetworkId] = useQueryState("network-id", parseAsInteger);

	const line = useLine(girouette ? undefined : journey.networkId, journey.lineId);
	const destination =
		journey.destination ?? journey.calls?.[journey.calls.length - 1]?.stopName ?? m.marker_destination_unknown();

	const defaultRouteNumber = line?.girouetteNumber ?? line?.number ?? "";

	// Les deux filtres sont exclusifs : passer sur une ligne lève un éventuel filtre réseau.
	const onRouteNumberClick = () => {
		setLineId(journey.lineId ?? null);
		setNetworkId(null);
	};

	const girouetteData: GirouetteData = girouette ?? {
		routeNumber:
			line !== undefined
				? {
						backgroundColor: line.color ?? undefined,
						textColor: line.textColor ?? undefined,
						outlineColor: getAutoOutlineColor(line.textColor, line.color),
						font: defaultRouteNumber.length <= 3 ? "1508SUPX" : "1407SUPX",
						scroll: defaultRouteNumber.length >= "KKKKK".length,
						spacing: defaultRouteNumber.length >= 4 ? 0 : 1,
						text: defaultRouteNumber ?? "",
					}
				: undefined,
		pages: [
			{
				font: guessFont(destination),
				scroll: shouldScroll(destination),
				text: destination,
			},
		],
	};

	// Le rechargement éteint toutes les diodes : ni numéro de ligne, ni destination.
	// Les dimensions, elles, sont conservées pour que le panneau garde sa place.
	const refreshing = useRefreshing(journey.id, girouetteData.pages);
	const displayedGirouette = refreshing ? { ...girouetteData, pages: [], routeNumber: undefined } : girouetteData;

	return (
		<div className="border-b-[1px] border-black">
			<Girouette ledColor="WHITE" onRouteNumberClick={onRouteNumberClick} width={width} {...displayedGirouette} />
		</div>
	);
}
