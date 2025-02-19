import { keepPreviousData, queryOptions } from "@tanstack/react-query";

import { client } from "~/api/client";
import type { DisposeableVehicleJourney } from "~/api/vehicle-journeys";
import type { GirouetteData } from "~/components/interactive-map/vehicles/girouette";

export const GetJourneyGirouetteQuery = (journey: DisposeableVehicleJourney, enabled: boolean) => {
	const destination = journey.destination ?? journey.calls?.at(-1)?.stopName;

	return queryOptions({
		enabled,
		placeholderData: keepPreviousData,
		refetchInterval: 30_000,
		staleTime: 30_000,
		queryKey: ["girouette", journey.networkId, journey.lineId, journey.direction, destination],
		queryFn: () => {
			const params = new URLSearchParams();
			params.append("networkId", journey.networkId.toString());
			if (journey.lineId) params.append("lineId", journey.lineId.toString());
			if (journey.direction) params.append("directionId", journey.direction.toString());
			if (destination) params.append("destination", destination);
			return client
				.get(`girouettes?${params.toString()}`)
				.then((response) => response.json<{ data: GirouetteData }[]>());
		},
		select: (girouettes) => girouettes.at(0),
	});
};
