import { Link } from "@tanstack/react-router";
import { ArrowLeftIcon, HistoryIcon, StarIcon } from "lucide-react";
import type { ReactNode } from "react";

import type { Network } from "~/api/networks";
import { Button } from "~/components/ui/button";
import { useOnlyNetworksWithHistory } from "~/hooks/use-only-networks-with-history";
import * as m from "~/paraglide/messages";
import { cardListClassName } from "~/routes/_app/data/-networks-list/card-list";
import { NetworksListCard } from "~/routes/_app/data/-networks-list/network-card";
import { NetworksListHistoryNotice, NetworksListNotice } from "~/routes/_app/data/-networks-list/notice";
import { NetworksListRegionCard } from "~/routes/_app/data/-networks-list/region-card";
import type { NetworksListView, RegionGroup } from "~/routes/_app/data/-networks-list/use-networks-list-view";
import { cn } from "~/utils/cn";

type NetworksListContentProps = {
	view: NetworksListView;
	withoutHistoryCount: number;
	favoriteNetworkIds: Set<number>;
	onToggleFavorite: (networkId: number) => void;
};

export function NetworksListContent({
	view,
	withoutHistoryCount,
	favoriteNetworkIds,
	onToggleFavorite,
}: Readonly<NetworksListContentProps>) {
	const [, setOnlyNetworksWithHistory] = useOnlyNetworksWithHistory();

	const renderGrid = (networks: Network[]) => (
		<ul className={cn(cardListClassName, "sm:grid-cols-2 lg:grid-cols-3")}>
			{networks.map((network) => (
				<li key={network.id}>
					<NetworksListCard
						isFavorite={favoriteNetworkIds.has(network.id)}
						network={network}
						onToggleFavorite={() => onToggleFavorite(network.id)}
					/>
				</li>
			))}
		</ul>
	);

	const historyNotice = withoutHistoryCount > 0 ? <NetworksListHistoryNotice /> : null;

	if (view.kind === "search") {
		return (
			<>
				{view.results.length > 0 ? (
					<NetworksListSection title={m.networks_list_count({ count: view.results.length })}>
						{renderGrid(view.results)}
					</NetworksListSection>
				) : (
					<NetworksListEmpty />
				)}
				{view.hiddenMatchCount > 0 && (
					<NetworksListNotice
						actionLabel={m.networks_list_show_all()}
						icon={HistoryIcon}
						onAction={() => setOnlyNetworksWithHistory(false)}
					>
						{m.networks_list_hidden_matches({ count: view.hiddenMatchCount })}
					</NetworksListNotice>
				)}
			</>
		);
	}

	if (view.kind === "region") {
		return (
			<>
				<NetworksListRegionHeader group={view.group} />
				{historyNotice}
				{renderGrid(view.group.networks)}
			</>
		);
	}

	const [singleRegion] = view.regions.length === 1 ? view.regions : [];
	const isEmpty = view.favorites.length === 0 && view.regions.length === 0 && view.others.length === 0;

	return (
		<>
			{historyNotice}
			{view.favorites.length > 0 && (
				<NetworksListSection
					title={
						<>
							<StarIcon className="size-3.5 fill-yellow-400 stroke-yellow-600" />
							{m.map_network_favorites()}
						</>
					}
				>
					{renderGrid(view.favorites)}
				</NetworksListSection>
			)}
			{singleRegion !== undefined && (
				<NetworksListSection title={singleRegion.title}>{renderGrid(singleRegion.networks)}</NetworksListSection>
			)}
			{view.regions.length > 1 && (
				<NetworksListSection title={m.map_network_regions()}>
					<ul className={cn(cardListClassName, "md:grid-cols-2 xl:grid-cols-3")}>
						{view.regions.map((group) => (
							<li key={group.region.id}>
								<NetworksListRegionCard group={group} />
							</li>
						))}
					</ul>
				</NetworksListSection>
			)}
			{view.others.length > 0 && (
				<NetworksListSection title={m.map_network_other()}>{renderGrid(view.others)}</NetworksListSection>
			)}
			{isEmpty && <NetworksListEmpty />}
		</>
	);
}

function NetworksListSection({ title, children }: Readonly<{ title: ReactNode; children: ReactNode }>) {
	return (
		<section className="flex flex-col gap-2">
			<h2 className="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
				{title}
			</h2>
			{children}
		</section>
	);
}

function NetworksListRegionHeader({ group }: Readonly<{ group: RegionGroup }>) {
	return (
		<div className="flex items-center gap-3">
			<Button
				aria-label={m.map_region_list_back()}
				nativeButton={false}
				render={
					<Link to="/data">
						<ArrowLeftIcon className="size-4" />
					</Link>
				}
				size="icon"
				title={m.map_region_list_back()}
				variant="outline"
			/>
			<div className="grid min-w-0 gap-0.5">
				<h2 className="truncate text-lg font-semibold leading-tight">{group.title}</h2>
				<p className="text-xs leading-tight text-muted-foreground">
					{m.map_region_network_count({ count: group.networks.length })}
				</p>
			</div>
		</div>
	);
}

function NetworksListEmpty() {
	return <p className="py-8 text-center text-sm text-muted-foreground">{m.networks_list_empty()}</p>;
}
