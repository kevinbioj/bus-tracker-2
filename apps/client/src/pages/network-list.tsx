import { useSuspenseQuery } from "@tanstack/react-query";
import { SearchIcon, StarIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDebounceValue, useLocalStorage } from "usehooks-ts";

import { GetNetworksQuery, type Network } from "~/api/networks";
import { GetRegionsQuery } from "~/api/regions";
import { Input } from "~/components/ui/input";
import { NetworksBlock } from "~/pages/network-list/networks-block";

const searchifyQuery = (query: string) =>
	query
		.toLowerCase()
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "");

export function NetworkList() {
	const { data: regions } = useSuspenseQuery(GetRegionsQuery);
	const { data: networks } = useSuspenseQuery(GetNetworksQuery);

	const scrollContainer = useRef<HTMLDivElement>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [debouncedSearchifiedSearchQuery] = useDebounceValue(searchifyQuery(searchQuery), 300);

	const [onlyNetworksWithHistory] = useLocalStorage("only-networks-with-history", true);
	const [favoriteNetworkIds] = useLocalStorage("favorite-networks", new Set<number>(), {
		deserializer: (value) => new Set(JSON.parse(value)),
		serializer: (value) => JSON.stringify(Array.from(value.values())),
	});

	// biome-ignore lint/correctness/useExhaustiveDependencies: effect runs on query updates
	useEffect(() => {
		scrollContainer.current?.scrollTo({ behavior: "smooth", top: 0 });
	}, [searchQuery]);

	const [favoriteNetworks, otherNetworks] = useMemo<[Network[], Network[]]>(() => {
		let innerNetworks = networks;
		if (innerNetworks === undefined) {
			return [[], []];
		}

		if (onlyNetworksWithHistory) {
			innerNetworks = innerNetworks.filter((network) => network.hasVehiclesFeature);
		}

		const groups = Map.groupBy(innerNetworks, (network) => {
			if (debouncedSearchifiedSearchQuery.length > 0) {
				const compareAgainst = [network.name, ...(network.authority ? [network.authority] : [])].map(searchifyQuery);
				if (compareAgainst.every((value) => !value.includes(debouncedSearchifiedSearchQuery))) {
					return "search-mismatch";
				}
			}

			return favoriteNetworkIds.has(network.id) ? "favorite" : "other";
		});
		return [groups.get("favorite") ?? [], groups.get("other") ?? []];
	}, [debouncedSearchifiedSearchQuery, favoriteNetworkIds, networks, onlyNetworksWithHistory]);

	const networksByRegion = useMemo(() => {
		if (regions === undefined) {
			return [];
		}

		const groups = Map.groupBy(otherNetworks, (network) => network.regionId ?? -1);
		const orphanNetworks = groups.get(-1);
		return [
			...regions.flatMap((region) => {
				const networks = groups.get(region.id);
				if (networks === undefined) {
					return [];
				}

				return {
					title: region.name,
					networks,
				};
			}),
			...(orphanNetworks !== undefined ? [{ title: "Autres réseaux", networks: orphanNetworks }] : []),
		];
	}, [regions, otherNetworks]);

	return (
		<>
			<title>Données – Bus Tracker</title>
			<main className="p-3 max-w-(--breakpoint-xl) w-full mx-auto h-[calc(100dvh-60px)] overflow-hidden flex flex-col">
				<div className="shrink-0 mb-2">
					<h2 className="font-bold text-2xl">Données des véhicules</h2>
					<p className="text-muted-foreground">Sélectionnez un réseau pour consulter ses véhicules et lignes.</p>
				</div>
				<div className="relative shrink-0 mb-3">
					<SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
					<Input
						className="pl-9"
						placeholder="Rechercher un réseau ou une ville…"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
					/>
				</div>
				<div className="px-3 flex flex-col gap-3 flex-1 overflow-y-auto pb-2" ref={scrollContainer}>
					{/* Favorite networks */}
					{favoriteNetworks.length > 0 && (
						<NetworksBlock
							title={
								<>
									<StarIcon className="fill-yellow-400 stroke-yellow-600 size-5" /> Réseaux favoris
								</>
							}
							networks={favoriteNetworks}
						/>
					)}
					{/* Other networks by region */}
					{networksByRegion.map((regionNetworks) => (
						<NetworksBlock key={regionNetworks.title} title={regionNetworks.title} networks={regionNetworks.networks} />
					))}
				</div>
			</main>
		</>
	);
}
