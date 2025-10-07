import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import type { CircleMarkerFeature, CircleMarkerSource } from "~/adapters/maplibre-gl/geojson-circles";
import { useMap } from "~/adapters/maplibre-gl/map";
import { client } from "~/api/client";
import type { DisposeableVehicleJourney } from "~/api/vehicle-journeys";

type JumpToProps = {
	openPopup: (feature: CircleMarkerFeature, type: "hover" | "selected") => void;
};

export function JumpTo({ openPopup }: JumpToProps) {
	const map = useMap();
	const location = useLocation();
	const navigate = useNavigate();

	const markerId = location.hash.slice(1);

	useEffect(() => {
		if (markerId.length === 0) return;

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
					if (abort) {
						map.off("sourcedata", onSourceData);
						return;
					}

					const source = e.source;
					const feature = source.data.features.find((feature) => feature.properties.id === journey.id);
					if (typeof feature === "undefined") return;

					openPopup(feature, "selected");
					map.off("sourcedata", onSourceData);
					navigate({ hash: "" });
					done = true;
				};

				map.on("sourcedata", onSourceData);
				setTimeout(() => {
					if (done) return;
					map.off("sourcedata", onSourceData);
					navigate({ hash: "" });
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
	}, [map, markerId, navigate, openPopup]);

	return null;
}
