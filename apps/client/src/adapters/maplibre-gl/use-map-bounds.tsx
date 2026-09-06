import type { LngLatBounds } from "maplibre-gl";
import { useEffect, useState } from "react";

import { useMap } from "~/adapters/maplibre-gl/map";

export function useMapBounds() {
	const map = useMap();
	const [bounds, setBounds] = useState<LngLatBounds>(map.getBounds());

	useEffect(() => {
		// `moveend` se déclenche aussi quand la carte revient à l'identique (clic, recentrage,
		// fin d'animation) : conserver l'objet précédent évite de faire rerendre tous les
		// consommateurs — et de relancer une requête de marqueurs — pour des bornes identiques.
		const onMoveEnd = () =>
			setBounds((previous) => {
				const next = map.getBounds();
				return previous.getSouthWest().lng === next.getSouthWest().lng &&
					previous.getSouthWest().lat === next.getSouthWest().lat &&
					previous.getNorthEast().lng === next.getNorthEast().lng &&
					previous.getNorthEast().lat === next.getNorthEast().lat
					? previous
					: next;
			});
		map.on("moveend", onMoveEnd);
		return () => {
			map.off("moveend", onMoveEnd);
		};
	}, [map]);

	return bounds;
}
