import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { parseAsString, useQueryState } from "nuqs";
import { useEffect } from "react";
import { useDebounceValue } from "usehooks-ts";
import { z } from "zod";

import { GetNetworksQuery } from "~/api/networks";
import { GetRegionsQuery } from "~/api/regions";
import { SearchBar } from "~/components/search-bar";
import { Canonical } from "~/components/seo";
import { useFavoriteNetworkIds } from "~/hooks/use-favorite-ids";
import * as m from "~/paraglide/messages";
import { formatNetworkNames } from "~/utils/network-seo";
import { NetworksListContent } from "./-networks-list/networks-list-content";
import { useNetworksListView } from "./-networks-list/use-networks-list-view";

const searchSchema = z.object({
	q: z.coerce.string().optional(),
	region: z.coerce.number().int().positive().optional().catch(undefined),
});

export const Route = createFileRoute("/_app/data/")({
	component: NetworksListPage,
	validateSearch: searchSchema,
	loader: async ({ context: { queryClient } }) => {
		await Promise.all([queryClient.ensureQueryData(GetRegionsQuery), queryClient.ensureQueryData(GetNetworksQuery)]);
	},
});

function NetworksListPage() {
	const regionId = Route.useSearch({ select: (search) => search.region });
	const [searchQuery, setSearchQuery] = useQueryState("q", parseAsString.withDefault(""));
	const [debouncedSearchQuery] = useDebounceValue(searchQuery.trim(), 300);
	const activeSearchQuery = searchQuery.trim().length > 0 ? debouncedSearchQuery : "";

	const [favoriteNetworkIds, toggleFavoriteNetworkId] = useFavoriteNetworkIds();
	const { view, withoutHistoryCount } = useNetworksListView(activeSearchQuery, regionId, favoriteNetworkIds);
	const { data: allNetworks } = useSuspenseQuery(GetNetworksQuery);
	const viewKey = view.kind === "region" ? `region-${view.group.region.id}` : view.kind;

	// biome-ignore lint/correctness/useExhaustiveDependencies: effect runs on view updates
	useEffect(() => {
		window.scrollTo({ behavior: "instant", top: 0 });
	}, [activeSearchQuery, viewKey]);

	return (
		<>
			<title>
				{view.kind === "region" ? m.page_title_data_region({ regionName: view.group.title }) : m.page_title_data()}
			</title>
			<meta
				content={
					view.kind === "region"
						? m.page_description_data_region({
								networkNames: formatNetworkNames(view.group.networks),
								regionName: view.group.title,
							})
						: m.page_description_data({ networkCount: m.map_region_network_count({ count: allNetworks.length }) })
				}
				name="description"
			/>
			<Canonical path={view.kind === "region" ? `/data?region=${view.group.region.id}` : "/data"} />
			<main className="mx-auto w-full max-w-(--breakpoint-xl) px-3 pb-8">
				<h1 className="pt-3 text-xl font-bold sm:pt-4 sm:text-2xl">{m.networks_list_title()}</h1>
				<div className="sticky top-14 z-1 -mx-3 bg-background px-3 py-2 sm:py-3">
					<SearchBar
						placeholder={m.networks_list_search_placeholder()}
						query={searchQuery}
						onQueryChange={(value) => setSearchQuery(value.length > 0 ? value : null)}
					/>
				</div>
				<p aria-live="polite" className="sr-only">
					{view.kind !== "search"
						? ""
						: view.results.length === 0
							? m.networks_list_empty()
							: m.networks_list_count({ count: view.results.length })}
				</p>
				<div
					className="flex flex-col gap-4 pt-1 animate-in sm:gap-6 fade-in duration-200 ease-out motion-reduce:animate-none"
					key={viewKey}
				>
					<NetworksListContent
						favoriteNetworkIds={favoriteNetworkIds}
						onToggleFavorite={toggleFavoriteNetworkId}
						view={view}
						withoutHistoryCount={withoutHistoryCount}
					/>
				</div>
			</main>
		</>
	);
}
