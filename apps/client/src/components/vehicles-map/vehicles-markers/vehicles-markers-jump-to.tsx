import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

import type { CircleMarkerFeature, CircleMarkerSource } from "~/adapters/maplibre-gl/geojson-circles";
import { useMap } from "~/adapters/maplibre-gl/map";
import { client } from "~/api/client";
import type { DisposeableVehicleJourney } from "~/api/vehicle-journeys";

type JumpToProps = {
	openPopup: (feature: CircleMarkerFeature, type: "hover" | "selected") => void;
};

export function JumpTo({ openPopup }: JumpToProps) {
	const map = useMap();
	const [searchParams, setSearchParams] = useSearchParams();

	const markerId = searchParams.get("marker-id");

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

				map.setCenter({ lng: journey.position.longitude, lat: journey.position.latitude });
				map.setZoom(13);

				let done = false;
				const onSourceData = (e: { source: CircleMarkerSource; sourceDataType: "content" | string }) => {
					const source = e.source;
					const feature = source.data?.features?.find((feature) => feature.properties.id === journey.id);
					if (typeof feature === "undefined") return;

					openPopup(feature, "selected");
					map.off("sourcedata", onSourceData);
					setSearchParams((searchParams) => {
						searchParams.delete("marker-id");
						return searchParams;
					});
					done = true;
				};

				map.on("sourcedata", onSourceData);
				setTimeout(() => {
					if (done) return;
					map.off("sourcedata", onSourceData);
					setSearchParams((searchParams) => {
						searchParams.delete("marker-id");
						return searchParams;
					});
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
	}, [map, markerId, openPopup, setSearchParams]);

	return null;
}
