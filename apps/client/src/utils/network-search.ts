import type { Network } from "~/api/networks";
import { type SearchField, searchItems } from "~/utils/search";

/** Champs comparés : le nom du réseau prime, l'autorité organisatrice porte souvent le nom de la ville. */
const NETWORK_FIELDS: ReadonlyArray<SearchField<Network>> = [
	{ pick: (network) => network.name, weight: 1 },
	{ pick: (network) => network.authority, weight: 0.9 },
	{ pick: (network) => network.ref, weight: 0.5 },
];

/** À pertinence égale, l'ordre alphabétique conserve une liste lisible. */
function compareNetworkTies(a: Network, b: Network) {
	return a.name.localeCompare(b.name);
}

/** Filtre puis ordonne des réseaux par pertinence. Une requête vide laisse la liste intacte. */
export function searchNetworks<T extends Network>(networks: T[], query: string): T[] {
	return searchItems(networks, query, NETWORK_FIELDS as ReadonlyArray<SearchField<T>>, compareNetworkTies);
}
