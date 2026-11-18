import { eq } from "drizzle-orm";

import { database } from "../../core/database/database.js";
import { networksTable, regionsTable } from "../../core/database/schema.js";
import { matchesSearchText } from "../../utils/search-text.js";
import { useCache } from "../../utils/use-cache.js";
import { ToolFailure } from "../define-tool.js";
import { DEFAULT_TIMEZONE } from "../presenters/time.js";

export type NetworkSummary = {
	id: number;
	ref: string;
	name: string;
	authority: string | null;
	countryCode: string;
	timezone: string;
	hasVehiclesFeature: boolean;
	region: string | null;
	logoHref: string | null;
	darkModeLogoHref: string | null;
};

const networksCache = useCache<Map<number, NetworkSummary>>(60_000, 1);

export function loadNetworks() {
	return networksCache.getOrLoad("all", readNetworks);
}

async function readNetworks() {
	const rows = await database
		.select({ network: networksTable, regionName: regionsTable.name })
		.from(networksTable)
		.leftJoin(regionsTable, eq(regionsTable.id, networksTable.regionId));

	return new Map<number, NetworkSummary>(
		rows.map(({ network, regionName }) => [
			network.id,
			{
				id: network.id,
				ref: network.ref,
				name: network.name,
				authority: network.authority,
				countryCode: network.countryCode,
				timezone: network.timezone,
				hasVehiclesFeature: network.hasVehiclesFeature,
				region: regionName !== null ? (regionName.fr ?? Object.values(regionName)[0] ?? null) : null,
				logoHref: network.logoHref,
				darkModeLogoHref: network.darkModeLogoHref,
			},
		]),
	);
}

export async function getNetwork(networkId: number) {
	const network = (await loadNetworks()).get(networkId);
	if (network === undefined) throw new ToolFailure(`No network found with id ${networkId}. Use search_networks.`);
	return network;
}

export async function timezoneOf(networkId: number) {
	return (await loadNetworks()).get(networkId)?.timezone ?? DEFAULT_TIMEZONE;
}

export async function networkNames(networkIds: number[]) {
	const networks = await loadNetworks();
	return networkIds.flatMap((networkId) => networks.get(networkId)?.name ?? []);
}

export const matchesNetwork = (network: NetworkSummary, query: string) =>
	matchesSearchText([network.name, network.authority, network.region, network.ref], query);
