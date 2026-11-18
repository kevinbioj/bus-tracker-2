import { and, asc, ilike, inArray, isNull } from "drizzle-orm";

import { database } from "../core/database/database.js";
import { linesTable, vehiclesTable } from "../core/database/schema.js";
import { findRecentLineDestinations } from "../core/services/line-destination-service.js";
import { searchStopAreas } from "../core/services/stop-search-service.js";
import { journeyStore } from "../core/store/journey-store.js";
import { escapeLikePattern, matchesSearchText, normalizeSearchText } from "../utils/search-text.js";
import { compareLineNumbers } from "./lookups/lines.js";
import { loadNetworks, matchesNetwork } from "./lookups/networks.js";

export const MAX_COMPLETIONS = 100;

const MIN_STOP_QUERY_LENGTH = 2;
const MAX_DESTINATION_LINES = 5;

const unique = (values: string[]) => [...new Set(values)].slice(0, MAX_COMPLETIONS);

const prefixPattern = (value: string) => `${escapeLikePattern(value.trim())}%`;

async function rankedNetworks(value: string) {
	const trackedJourneys = Map.groupBy(journeyStore.values(), (journey) => journey.networkId);
	return [...(await loadNetworks()).values()]
		.filter((network) => matchesNetwork(network, value))
		.toSorted(
			(a, b) =>
				(trackedJourneys.get(b.id)?.length ?? 0) - (trackedJourneys.get(a.id)?.length ?? 0) ||
				a.name.localeCompare(b.name),
		);
}

async function networkIdsMatching(networkText: string | undefined) {
	if (networkText === undefined || normalizeSearchText(networkText) === "") return undefined;
	return (await rankedNetworks(networkText)).map((network) => network.id);
}

async function linesMatching(value: string, networkIds: number[] | undefined) {
	if (networkIds !== undefined && networkIds.length === 0) return [];
	return database
		.select({ id: linesTable.id, number: linesTable.number })
		.from(linesTable)
		.where(
			and(
				ilike(linesTable.number, prefixPattern(value)),
				networkIds !== undefined ? inArray(linesTable.networkId, networkIds) : undefined,
				isNull(linesTable.archivedAt),
			),
		)
		.orderBy(asc(linesTable.number))
		.limit(MAX_COMPLETIONS);
}

export async function completeNetworkNames(value: string) {
	return unique((await rankedNetworks(value)).map((network) => network.name));
}

export async function completeLineNumbers(value: string, networkText?: string) {
	const lines = await linesMatching(value, await networkIdsMatching(networkText));
	return unique(lines.map((line) => line.number).toSorted(compareLineNumbers));
}

export async function completeStopNames(value: string, networkText?: string) {
	if (normalizeSearchText(value).length < MIN_STOP_QUERY_LENGTH) return [];
	const matches = await searchStopAreas({
		query: value,
		networkIds: await networkIdsMatching(networkText),
		limit: MAX_COMPLETIONS,
	});
	return unique((matches ?? []).map((stopArea) => stopArea.name));
}

export async function completeVehicleNumbers(value: string, networkText?: string) {
	const networkIds = await networkIdsMatching(networkText);
	if (networkIds === undefined || networkIds.length === 0) return [];

	const vehicles = await database
		.select({ number: vehiclesTable.number })
		.from(vehiclesTable)
		.where(
			and(
				inArray(vehiclesTable.networkId, networkIds),
				ilike(vehiclesTable.number, prefixPattern(value)),
				isNull(vehiclesTable.archivedAt),
			),
		)
		.limit(MAX_COMPLETIONS);
	return unique(vehicles.map((vehicle) => vehicle.number).toSorted(compareLineNumbers));
}

export async function completeDestinations(value: string, networkText?: string, lineText?: string) {
	if (lineText === undefined || lineText.trim() === "") return [];
	const lines = await linesMatching(lineText, await networkIdsMatching(networkText));
	const exactLines = lines.filter((line) => normalizeSearchText(line.number) === normalizeSearchText(lineText));

	const destinations = await Promise.all(
		(exactLines.length > 0 ? exactLines : lines)
			.slice(0, MAX_DESTINATION_LINES)
			.map((line) => findRecentLineDestinations(line.id)),
	);
	return unique(destinations.flat().filter((destination) => matchesSearchText([destination], value)));
}

export async function completeNetworkIds(value: string) {
	if (/^\d+$/.test(value)) {
		const networks = await loadNetworks();
		return unique([...networks.keys()].map(String).filter((id) => id.startsWith(value)));
	}
	return unique((await rankedNetworks(value)).map((network) => String(network.id)));
}

export async function completeLineIds(value: string) {
	return unique((await linesMatching(value, undefined)).map((line) => String(line.id)));
}

export async function completeVehicleIds(value: string) {
	const vehicles = await database
		.select({ id: vehiclesTable.id })
		.from(vehiclesTable)
		.where(and(ilike(vehiclesTable.number, prefixPattern(value)), isNull(vehiclesTable.archivedAt)))
		.limit(MAX_COMPLETIONS);
	return unique(vehicles.map((vehicle) => String(vehicle.id)));
}

export async function completeJourneyIds(value: string) {
	const needle = value.trim().toLowerCase();
	return unique(
		journeyStore
			.values()
			.filter(
				(journey) =>
					journey.id.toLowerCase().includes(needle) || journey.vehicle?.number.toLowerCase().startsWith(needle),
			)
			.map((journey) => journey.id)
			.take(MAX_COMPLETIONS)
			.toArray(),
	);
}

export async function completeStopRefs(value: string) {
	if (normalizeSearchText(value).length < MIN_STOP_QUERY_LENGTH) return [];
	const matches = await searchStopAreas({ query: value, limit: MAX_COMPLETIONS });
	return unique((matches ?? []).map((stopArea) => stopArea.ref));
}
