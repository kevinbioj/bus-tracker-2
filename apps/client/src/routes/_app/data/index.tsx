import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { GetNetworksQuery } from "~/api/networks";
import { GetRegionsQuery } from "~/api/regions";
import * as m from "~/paraglide/messages";
import { NetworksListHeaderBlock } from "./-networks-list/header-block";
import { NetworksListVirtualList } from "./-networks-list/virtual-list";

const searchSchema = z.object({
	q: z.coerce.string().optional(),
	region: z.coerce.string().optional(),
});

export const Route = createFileRoute("/_app/data/")({
	component: NetworksListPage,
	validateSearch: searchSchema,
	loader: async ({ context: { queryClient } }) => {
		await Promise.all([queryClient.ensureQueryData(GetRegionsQuery), queryClient.ensureQueryData(GetNetworksQuery)]);
	},
});

function NetworksListPage() {
	return (
		<>
			<title>{m.page_title_data()}</title>
			<main>
				<NetworksListHeaderBlock className="sticky top-14" />
				<NetworksListVirtualList />
			</main>
		</>
	);
}
