import { queryOptions } from "@tanstack/react-query";

import { client } from "~/api/client";
import type { DisposeableVehicleJourney } from "~/api/vehicle-journeys";
import type { GirouetteData } from "~/components/interactive-map/girouette";

export const GetJourneyGirouetteQuery = (journey: DisposeableVehicleJourney) =>
	queryOptions({
		queryKey: ["girouette", journey.network.id, journey.line?.id, journey.direction, journey.destination],
		queryFn: () => {
			const params = new URLSearchParams();
			params.append("networkId", journey.network.id.toString());
			if (journey.line) params.append("lineId", journey.line.id.toString());
			if (journey.direction) params.append("directionId", journey.direction.toString());
			if (journey.destination) params.append("destination", journey.destination);
			return client
				.get(`girouettes?${params.toString()}`)
				.then((response) => response.json<{ data: GirouetteData }[]>());
		},
	});
