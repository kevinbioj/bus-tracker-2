import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { GetNetworksQuery } from "~/api/networks";
import { GetRegionsQuery } from "~/api/regions";
import { NetworksListPage } from "~/pages/networks-list/page";

const searchSchema = z.object({
	q: z.coerce.string().optional(),
});

export const Route = createFileRoute("/_app/data/")({
	component: NetworksListPage,
	validateSearch: searchSchema,
	loader: async ({ context: { queryClient } }) => {
		await Promise.all([queryClient.ensureQueryData(GetRegionsQuery), queryClient.ensureQueryData(GetNetworksQuery)]);
	},
});
