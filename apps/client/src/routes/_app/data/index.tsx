import { createFileRoute } from "@tanstack/react-router";

import { GetNetworksQuery } from "~/api/networks";
import { GetRegionsQuery } from "~/api/regions";
import { NetworkList } from "~/pages/networks-list";

export const Route = createFileRoute("/_app/data/")({
	component: NetworkList,
	loader: async ({ context: { queryClient } }) => {
		await Promise.all([
			queryClient.ensureQueryData(GetRegionsQuery),
			queryClient.ensureQueryData(GetNetworksQuery),
		]);
	},
});
