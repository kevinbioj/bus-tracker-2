import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { GetNetworksQuery } from "~/api/networks";
import { GetRegionsQuery } from "~/api/regions";
import { useIsCountryDisplayed } from "~/components/vehicles-map/displayed-countries";

/**
 * Régions ayant au moins un réseau visible au regard du réglage « Pays à afficher ». Partagé par
 * l'en-tête et la liste pour qu'un filtre de région proposé mène toujours à un résultat.
 */
export function useDisplayedRegions() {
	const { data: regions } = useSuspenseQuery(GetRegionsQuery);
	const { data: networks } = useSuspenseQuery(GetNetworksQuery);
	const isCountryDisplayed = useIsCountryDisplayed();

	return useMemo(() => {
		const populatedRegionIds = new Set(
			networks.flatMap((network) =>
				network.regionId !== null && isCountryDisplayed(network.countryCode) ? [network.regionId] : [],
			),
		);

		return regions.filter((region) => populatedRegionIds.has(region.id));
	}, [regions, networks, isCountryDisplayed]);
}
