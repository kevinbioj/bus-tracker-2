import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { GetNetworkDataSourcesQuery } from "~/api/data-sources";
import { GetNetworkQuery } from "~/api/networks";
import { GetVehiclesQuery } from "~/api/vehicles";
import { NetworkDetails } from "./-network-details-page";

const searchSchema = z.object({
	tab: z.coerce.string().optional(),
	type: z.coerce.string().optional(),
	operatorId: z.coerce.string().optional(),
	filter: z.coerce.string().optional(),
	sort: z.coerce.string().optional(),
	archived: z.coerce.boolean().optional(),
});

export const Route = createFileRoute("/_app/data/networks/$networkId")({
	component: NetworkDetails,
	validateSearch: searchSchema,
	loader: async ({ context: { queryClient }, params: { networkId } }) => {
		// Préchargé plutôt qu'exigé : l'en-tête ne doit pas se décaler à l'arrivée des sources, mais
		// leur absence — ou un serveur qui ignore la route — ne doit pas empêcher la page de s'afficher.
		const dataSources = queryClient.prefetchQuery(GetNetworkDataSourcesQuery(+networkId));

		const network = await queryClient.ensureQueryData(GetNetworkQuery(+networkId, true));
		if (network.hasVehiclesFeature) {
			await queryClient.ensureQueryData(GetVehiclesQuery(+networkId));
			await queryClient.ensureQueryData(GetNetworkQuery(+networkId, true, true));
		}

		await dataSources;
	},
});
