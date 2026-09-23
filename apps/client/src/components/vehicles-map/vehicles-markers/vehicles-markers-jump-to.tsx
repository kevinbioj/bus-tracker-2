import type { SourceSpecification } from "maplibre-gl";
import { useQueryState } from "nuqs";
import { useEffect } from "react";

import type { CircleMarkerFeature, CircleMarkerSource } from "~/adapters/maplibre-gl/geojson-circles";
import { useMap } from "~/adapters/maplibre-gl/map";
import { client } from "~/api/client";
import type { DisposeableVehicleJourney } from "~/api/vehicle-journeys";
import { getMapBottomOverlayHeight } from "~/components/vehicles-map/map-bottom-overlay";

/** Décalage vertical du véhicule accroché sous le centre de la carte, en part de sa hauteur. */
const JUMP_TO_VERTICAL_OFFSET_RATIO = 0.2 / 3;

/**
 * Position du véhicule quand un drawer masque le bas de la carte, en part de la hauteur restée visible
 * depuis son bord supérieur : plus bas qu'au centre, la partie visible étant courte, pour laisser la
 * place à la popup au-dessus de lui.
 */
const JUMP_TO_ABOVE_OVERLAY_POSITION_RATIO = 0.75;

type JumpToProps = {
	openPopup: (feature: CircleMarkerFeature, type: "hover" | "selected") => void;
};

export function JumpTo({ openPopup }: JumpToProps) {
	const map = useMap();
	const [markerId, setMarkerId] = useQueryState("marker-id");

	useEffect(() => {
		if (markerId === null) return;

		let abort = false;

		async function jumpTo() {
			if (abort) return;

			try {
				const journey = await client
					.get(`vehicle-journeys/${markerId}`)
					.then((response) => response.json<DisposeableVehicleJourney>());
				if (abort) return;

				// Le véhicule est placé sous le centre de la carte : sa popup, qui s'ouvre au-dessus de lui,
				// ne vient pas buter contre les contrôles du haut de la carte (sur mobile notamment). Un drawer
				// ouvert en bas de l'écran en masque une partie : le véhicule est alors placé dans ce qu'il en
				// reste.
				const container = map.getContainer();
				const hiddenHeight = getMapBottomOverlayHeight(container);
				const visibleHeight = container.clientHeight - hiddenHeight;
				const verticalOffset =
					hiddenHeight > 0
						? visibleHeight * JUMP_TO_ABOVE_OVERLAY_POSITION_RATIO - container.clientHeight / 2
						: container.clientHeight * JUMP_TO_VERTICAL_OFFSET_RATIO;
				map.easeTo({
					center: { lng: journey.position.longitude, lat: journey.position.latitude },
					zoom: 13,
					offset: [0, verticalOffset],
					duration: 0,
				});

				let done = false;
				const onSourceData = (e: { source: SourceSpecification; sourceDataType: "content" | string }) => {
					const source = e.source as CircleMarkerSource;
					const feature = source.data?.features?.find((feature) => feature.properties.id === journey.id);
					if (feature === undefined) return;

					openPopup(feature, "selected");
					map.off("sourcedata", onSourceData);
					setMarkerId(null);
					done = true;
				};

				map.on("sourcedata", onSourceData);
				setTimeout(() => {
					if (done) return;
					map.off("sourcedata", onSourceData);
					setMarkerId(null);
				}, 5000);
			} catch (e) {
				console.error(e);
			} finally {
			}
		}

		jumpTo();

		return () => {
			abort = true;
		};
	}, [map, markerId, openPopup, setMarkerId]);

	return null;
}
