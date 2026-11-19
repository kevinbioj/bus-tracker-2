import type { SourceSpecification } from "maplibre-gl";
import { useQueryState } from "nuqs";
import { useEffect, useLayoutEffect, useRef } from "react";

import type { CircleMarkerFeature, CircleMarkerSource } from "~/adapters/maplibre-gl/geojson-circles";
import { useMap } from "~/adapters/maplibre-gl/map";
import { client } from "~/api/client";
import type { DisposeableVehicleJourney } from "~/api/vehicle-journeys";
import { getMapBottomOverlayHeight } from "~/components/vehicles-map/map-bottom-overlay";

/** Décalage vertical du véhicule accroché sous le centre de la carte, en part de sa hauteur. */
const JUMP_TO_VERTICAL_OFFSET_RATIO = 0.2 / 3;

/**
 * Position du véhicule sur petit écran, ou quand un drawer masque le bas de la carte, en part de la
 * hauteur restée visible depuis son bord supérieur : plus bas qu'au centre, la partie visible étant
 * courte, pour laisser la place à la popup au-dessus de lui.
 */
const JUMP_TO_LOW_POSITION_RATIO = 0.75;

const DESKTOP_MEDIA_QUERY = "(min-width: 640px)";

type JumpToProps = {
	openPopup: (feature: CircleMarkerFeature, type: "hover" | "selected") => void;
};

export function JumpTo({ openPopup }: JumpToProps) {
	const map = useMap();
	const [markerId, setMarkerId] = useQueryState("marker-id");
	const openPopupRef = useRef(openPopup);
	useLayoutEffect(() => {
		openPopupRef.current = openPopup;
	}, [openPopup]);

	useEffect(() => {
		if (markerId === null) return;

		let abort = false;
		let timeout: ReturnType<typeof setTimeout> | undefined;
		let onSourceData:
			| ((e: { sourceId: string; source: SourceSpecification; sourceDataType: "content" | string }) => void)
			| undefined;

		const release = () => {
			if (onSourceData !== undefined) map.off("sourcedata", onSourceData);
			clearTimeout(timeout);
			setMarkerId((current) => (current === markerId ? null : current));
		};

		async function jumpTo() {
			try {
				const journey = await client
					.get(`vehicle-journeys/${markerId}`)
					.then((response) => response.json<DisposeableVehicleJourney>());
				if (abort) return;

				// Le véhicule est placé sous le centre de la carte : sa popup, qui s'ouvre au-dessus de lui,
				// ne vient pas buter contre les contrôles du haut de la carte. Sur mobile, il descend plus
				// bas encore, la popup d'un véhicule aux nombreux arrêts à desservir étant haute. Un drawer
				// ouvert en bas de l'écran en masque une partie : le véhicule est alors placé dans ce qu'il en
				// reste.
				const container = map.getContainer();
				const hiddenHeight = getMapBottomOverlayHeight(container);
				const visibleHeight = container.clientHeight - hiddenHeight;
				const verticalOffset =
					hiddenHeight > 0 || !window.matchMedia(DESKTOP_MEDIA_QUERY).matches
						? visibleHeight * JUMP_TO_LOW_POSITION_RATIO - container.clientHeight / 2
						: container.clientHeight * JUMP_TO_VERTICAL_OFFSET_RATIO;
				map.easeTo({
					center: { lng: journey.position.longitude, lat: journey.position.latitude },
					zoom: 13,
					offset: [0, verticalOffset],
					duration: 0,
				});

				const tryOpen = (source: SourceSpecification | undefined) => {
					const feature = (source as CircleMarkerSource | undefined)?.data?.features?.find(
						(feature) => feature.properties.id === journey.id,
					);
					if (feature === undefined) return false;

					openPopupRef.current(feature, "selected");
					release();
					return true;
				};

				if (tryOpen(map.getSource("vehicles")?.serialize())) return;

				onSourceData = (e) => {
					if (e.sourceId !== "vehicles" || e.sourceDataType !== "content") return;
					tryOpen(e.source);
				};

				map.on("sourcedata", onSourceData);
				timeout = setTimeout(release, 5000);
			} catch (e) {
				console.error(e);
				if (!abort) release();
			}
		}

		jumpTo();

		return () => {
			abort = true;
			if (onSourceData !== undefined) map.off("sourcedata", onSourceData);
			clearTimeout(timeout);
		};
	}, [map, markerId, setMarkerId]);

	return null;
}
