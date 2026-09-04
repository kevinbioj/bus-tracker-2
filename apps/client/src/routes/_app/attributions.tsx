import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { SearchIcon } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { useMemo } from "react";
import { useDebounceValue } from "usehooks-ts";

import { GetDataSourcesQuery, type NetworkDataSources } from "~/api/data-sources";
import { GetRegionsQuery } from "~/api/regions";
import { TitleSeparator } from "~/components/title-separator";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import { useIsCountryDisplayed } from "~/components/vehicles-map/displayed-countries";
import * as m from "~/paraglide/messages";
import { NetworkAttributionCard } from "~/routes/_app/-components/attributions/network-attribution-card";
import { searchNetworks } from "~/utils/network-search";

export const Route = createFileRoute("/_app/attributions")({
	component: AttributionsPage,
	loader: async ({ context: { queryClient } }) => {
		await Promise.all([queryClient.ensureQueryData(GetRegionsQuery), queryClient.ensureQueryData(GetDataSourcesQuery)]);
	},
});

type AttributionsBlock = {
	key: string;
	title: string;
	entries: NetworkDataSources[];
};

function AttributionsPage() {
	const { data: regions } = useSuspenseQuery(GetRegionsQuery);
	const { data: networkDataSources } = useSuspenseQuery(GetDataSourcesQuery);

	const [searchQuery, setSearchQuery] = useQueryState("q", parseAsString.withDefault(""));
	const [debouncedSearchQuery] = useDebounceValue(searchQuery.trim(), 300);
	const isCountryDisplayed = useIsCountryDisplayed();

	const blocks = useMemo(() => {
		const visibleEntries = networkDataSources.filter((entry) => isCountryDisplayed(entry.network.countryCode));

		// La recherche porte sur le réseau : c'est l'entrée naturelle d'une page d'attributions.
		const matchingNetworks = new Set(
			searchNetworks(
				visibleEntries.map((entry) => entry.network),
				debouncedSearchQuery,
			).map((network) => network.id),
		);
		const matchingEntries = visibleEntries.filter((entry) => matchingNetworks.has(entry.network.id));

		const regionBlocks: AttributionsBlock[] = regions.flatMap((region) => {
			const entries = matchingEntries.filter((entry) => entry.network.regionId === region.id);
			return entries.length === 0 ? [] : [{ key: String(region.id), title: region.name, entries }];
		});

		const otherEntries = matchingEntries.filter(
			(entry) => entry.network.regionId === null || !regions.some((region) => region.id === entry.network.regionId),
		);

		return otherEntries.length === 0
			? regionBlocks
			: [...regionBlocks, { key: "other", title: m.map_network_other(), entries: otherEntries }];
	}, [networkDataSources, regions, debouncedSearchQuery, isCountryDisplayed]);

	return (
		<>
			<title>{m.attributions_page_title()}</title>
			<main className="p-3 max-w-(--breakpoint-xl) w-full mx-auto space-y-4">
				<div>
					<h1 className="font-bold text-2xl">{m.attributions_title()}</h1>
					<p className="text-muted-foreground">{m.attributions_intro()}</p>
					<Separator className="mt-2" />
				</div>

				<div className="relative">
					<SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
					<Input
						className="pl-9"
						onChange={(event) => setSearchQuery(event.target.value || null)}
						placeholder={m.attributions_search_placeholder()}
						value={searchQuery}
					/>
				</div>

				{blocks.length === 0 ? (
					<p className="py-8 text-center text-muted-foreground">{m.attributions_empty()}</p>
				) : (
					blocks.map((block) => (
						<section className="flex flex-col gap-2" key={block.key}>
							<TitleSeparator TitleComponent="h2" className="text-base">
								{block.title}
							</TitleSeparator>
							<ul className="grid gap-3 grid-cols-1 lg:grid-cols-2">
								{block.entries.map((entry) => (
									<li key={entry.network.id}>
										<NetworkAttributionCard entry={entry} />
									</li>
								))}
							</ul>
						</section>
					))
				)}
			</main>
		</>
	);
}
