import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { GetNetworkQuery } from "~/api/networks";
import { GetVehiclesQuery } from "~/api/vehicles";
import { NetworkDetails } from "~/pages/network-details";

const searchSchema = z.object({
	tab: z.string().optional(),
	type: z.string().optional(),
	operatorId: z.string().optional(),
	filter: z.string().optional(),
	sort: z.string().optional(),
});

export const Route = createFileRoute("/_app/data/networks/$networkId")({
	component: NetworkDetails,
	validateSearch: searchSchema,
	loader: async ({ context: { queryClient }, params: { networkId } }) => {
		const network = await queryClient.ensureQueryData(GetNetworkQuery(+networkId, true));
		if (network.hasVehiclesFeature) {
			await queryClient.ensureQueryData(GetVehiclesQuery(+networkId));
			await queryClient.ensureQueryData(GetNetworkQuery(+networkId, true, true));
		}
	},
});
