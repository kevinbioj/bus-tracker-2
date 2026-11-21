import type { VehicleJourneyLineType } from "@bus-tracker/contracts";
import { and, count, eq, isNull } from "drizzle-orm";

import * as m from "../../paraglide/messages.js";
import type { Locale } from "../../paraglide/runtime.js";
import { useCache } from "../../utils/use-cache.js";
import { idSchema } from "../../utils/validator-helpers.js";
import { database } from "../database/database.js";
import {
	type LineEntity,
	linesTable,
	type NetworkEntity,
	networksTable,
	regionsTable,
	vehiclesTable,
} from "../database/schema.js";
import { findLineDetails } from "./line-details-service.js";

export type PageHead = {
	title: string;
	description?: string;
	canonicalPath: string | null;
};

const CACHE_TTL = 5 * 60 * 1000;
const MAX_CACHED_ENTITIES = 5000;
const MAX_LISTED_NETWORK_NAMES = 6;

type ModeLine = Pick<LineEntity, "archivedAt" | "type">;
type NetworkSummary = Pick<NetworkEntity, "id" | "name" | "authority">;

type NetworkPageData = {
	network: NetworkEntity;
	lines: ModeLine[];
	activeVehicleCount: number | null;
};

type VehiclePageData = {
	number: string;
	designation: string | null;
	network: NetworkSummary;
};

const modeLabels: Record<Exclude<VehicleJourneyLineType, "UNKNOWN">, typeof m.network_modes_bus> = {
	BUS: m.network_modes_bus,
	TROLLEY: m.network_modes_trolley,
	COACH: m.network_modes_coach,
	FERRY: m.network_modes_ferry,
	RAIL: m.network_modes_rail,
	SUBWAY: m.network_modes_subway,
	TRAMWAY: m.network_modes_tramway,
	FUNICULAR: m.network_modes_funicular,
	GONDOLA: m.network_modes_gondola,
};

const networkCache = useCache<NetworkPageData | null>(CACHE_TTL, MAX_CACHED_ENTITIES);
const networkSummaryCache = useCache<NetworkSummary | null>(CACHE_TTL, MAX_CACHED_ENTITIES);
const vehicleCache = useCache<VehiclePageData | null>(CACHE_TTL, MAX_CACHED_ENTITIES);
const directoryCache = useCache<Awaited<ReturnType<typeof loadDirectory>>>(CACHE_TTL);

const isActiveLine = ({ archivedAt }: Pick<LineEntity, "archivedAt">) =>
	archivedAt === null || Temporal.Instant.compare(Temporal.Now.instant(), archivedAt) < 0;

const getNetworkLabel = ({ name, authority }: Pick<NetworkEntity, "name" | "authority">) => {
	const trimmedAuthority = authority?.trim();
	return trimmedAuthority ? `${name} (${trimmedAuthority})` : name;
};

const getLineLabel = (line: Pick<LineEntity, "girouetteNumber" | "number">, locale: Locale) =>
	line.girouetteNumber ? line.number : m.network_lines_label({ lineNumber: line.number }, { locale });

function formatNetworkModes(lines: ModeLine[], locale: Locale) {
	const lineCountByMode = new Map<keyof typeof modeLabels, number>();
	for (const line of lines) {
		if (line.type === null || line.type === "UNKNOWN" || !isActiveLine(line)) continue;
		lineCountByMode.set(line.type, (lineCountByMode.get(line.type) ?? 0) + 1);
	}

	if (lineCountByMode.size === 0) return m.network_modes_fallback({}, { locale });

	const modes = Array.from(lineCountByMode)
		.toSorted(([, a], [, b]) => b - a)
		.map(([mode]) => modeLabels[mode]({}, { locale }));
	return new Intl.ListFormat(locale, { type: "conjunction" }).format(modes);
}

function formatNetworkNames(networks: Pick<NetworkEntity, "name">[], locale: Locale) {
	const names = networks.map(({ name }) => name);
	return names.length > MAX_LISTED_NETWORK_NAMES
		? `${names.slice(0, MAX_LISTED_NETWORK_NAMES).join(", ")}…`
		: new Intl.ListFormat(locale, { type: "conjunction" }).format(names);
}

const parsePositiveInteger = (value: string | null) => {
	if (value === null) return undefined;
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};

async function loadDirectory() {
	const [networks, regions] = await Promise.all([
		database
			.select({
				id: networksTable.id,
				name: networksTable.name,
				countryCode: networksTable.countryCode,
				hasVehiclesFeature: networksTable.hasVehiclesFeature,
				regionId: networksTable.regionId,
			})
			.from(networksTable),
		database.select().from(regionsTable).orderBy(regionsTable.sortOrder),
	]);
	return { networks: networks.toSorted((a, b) => a.name.localeCompare(b.name)), regions };
}

async function loadNetworkPageData(networkId: number): Promise<NetworkPageData | null> {
	const [network] = await database.select().from(networksTable).where(eq(networksTable.id, networkId));
	if (network === undefined) return null;

	const lines = await database
		.select({
			archivedAt: linesTable.archivedAt,
			number: linesTable.number,
			sortOrder: linesTable.sortOrder,
			type: linesTable.type,
		})
		.from(linesTable)
		.where(eq(linesTable.networkId, networkId));

	let activeVehicleCount: number | null = null;
	if (network.hasVehiclesFeature) {
		const [result] = await database
			.select({ value: count() })
			.from(vehiclesTable)
			.where(and(eq(vehiclesTable.networkId, networkId), isNull(vehiclesTable.archivedAt)));
		activeVehicleCount = result?.value ?? 0;
	}

	return {
		network,
		lines: lines.toSorted((a, b) => {
			const sortOrderDiff = (a.sortOrder ?? lines.length) - (b.sortOrder ?? lines.length);
			return sortOrderDiff || Number.parseInt(a.number, 10) - Number.parseInt(b.number, 10);
		}),
		activeVehicleCount,
	};
}

async function loadNetworkSummary(networkId: number): Promise<NetworkSummary | null> {
	const [network] = await database
		.select({ id: networksTable.id, name: networksTable.name, authority: networksTable.authority })
		.from(networksTable)
		.where(eq(networksTable.id, networkId));
	return network ?? null;
}

async function loadVehiclePageData(vehicleId: number): Promise<VehiclePageData | null> {
	const [data] = await database
		.select({
			number: vehiclesTable.number,
			designation: vehiclesTable.designation,
			network: { id: networksTable.id, name: networksTable.name, authority: networksTable.authority },
		})
		.from(vehiclesTable)
		.innerJoin(networksTable, eq(networksTable.id, vehiclesTable.networkId))
		.where(eq(vehiclesTable.id, vehicleId));
	return data ?? null;
}

const findNetworkSummary = (networkId: number) =>
	networkSummaryCache.getOrLoad(String(networkId), () => loadNetworkSummary(networkId));

const notFoundHead = (locale: Locale): PageHead => ({
	title: m.not_found_page_title({}, { locale }),
	canonicalPath: null,
});

async function resolveMapHead(search: URLSearchParams, locale: Locale): Promise<PageHead> {
	const rawLineId = search.get("line-id");
	const rawNetworkId = search.get("network-id");

	if (rawLineId !== null) {
		const lineId = idSchema.safeParse(rawLineId);
		if (!lineId.success) return notFoundHead(locale);

		const line = await findLineDetails(lineId.data);
		if (line === undefined) return notFoundHead(locale);

		const network = await findNetworkSummary(line.networkId);
		if (network === null) return notFoundHead(locale);

		const lineLabel = getLineLabel(line, locale);
		const networkLabel = getNetworkLabel(network);
		return {
			title: m.page_title_map_line({ lineLabel, networkName: network.name }, { locale }),
			description: m.page_description_map_line({ lineLabel, network: networkLabel }, { locale }),
			canonicalPath: null,
		};
	}

	if (rawNetworkId !== null) {
		const networkId = idSchema.safeParse(rawNetworkId);
		if (!networkId.success) return notFoundHead(locale);

		const data = await networkCache.getOrLoad(String(networkId.data), () => loadNetworkPageData(networkId.data));
		if (data === null) return notFoundHead(locale);

		const { network, lines } = data;
		const modes = formatNetworkModes(lines, locale);
		return {
			title: m.page_title_map_network({ modes, networkName: network.name }, { locale }),
			description: m.page_description_map_network({ modes, network: getNetworkLabel(network) }, { locale }),
			canonicalPath: lines.some(isActiveLine) ? `/?network-id=${network.id}` : null,
		};
	}

	return {
		title: m.page_title_map({}, { locale }),
		description: m.page_description_map({}, { locale }),
		canonicalPath: "/",
	};
}

async function resolveDataHead(search: URLSearchParams, locale: Locale): Promise<PageHead> {
	const { networks, regions } = await directoryCache.getOrLoad("directory", loadDirectory);

	const searchQuery = search.get("q")?.trim() ?? "";
	const regionId = parsePositiveInteger(search.get("region"));

	const listedNetworks = networks.filter(
		(network) => network.countryCode === "FR" && network.hasVehiclesFeature && network.regionId !== null,
	);
	const regionGroups = regions.flatMap((region) => {
		const regionNetworks = listedNetworks.filter((network) => network.regionId === region.id);
		return regionNetworks.length === 0 ? [] : [{ region, networks: regionNetworks }];
	});

	const selectedGroup =
		searchQuery.length === 0 && regionGroups.length > 1
			? regionGroups.find((group) => group.region.id === regionId)
			: undefined;

	if (selectedGroup !== undefined) {
		const { name } = selectedGroup.region;
		const regionName = name[locale] ?? name.fr ?? Object.values(name)[0] ?? "";
		return {
			title: m.page_title_data_region({ regionName }, { locale }),
			description: m.page_description_data_region(
				{ networkNames: formatNetworkNames(selectedGroup.networks, locale), regionName },
				{ locale },
			),
			canonicalPath: null,
		};
	}

	return {
		title: m.page_title_data({}, { locale }),
		description: m.page_description_data(
			{ networkCount: m.map_region_network_count({ count: networks.length }, { locale }) },
			{ locale },
		),
		canonicalPath: "/data",
	};
}

async function resolveNetworkHead(networkId: number, locale: Locale) {
	const data = await networkCache.getOrLoad(String(networkId), () => loadNetworkPageData(networkId));
	if (data === null) return notFoundHead(locale);

	const { network, lines, activeVehicleCount } = data;
	const networkLabel = getNetworkLabel(network);
	const lineCount = m.seo_line_count({ count: lines.filter(isActiveLine).length }, { locale });

	return {
		title: m.page_title_network_data({ modes: formatNetworkModes(lines, locale), network: networkLabel }, { locale }),
		description:
			activeVehicleCount === null
				? m.page_description_network_without_vehicles({ lineCount, network: networkLabel }, { locale })
				: m.page_description_network(
						{
							lineCount,
							network: networkLabel,
							vehicleCount: m.seo_vehicle_count({ count: activeVehicleCount }, { locale }),
						},
						{ locale },
					),
		canonicalPath: null,
	};
}

async function resolveVehicleHead(vehicleId: number, locale: Locale) {
	const vehicle = await vehicleCache.getOrLoad(String(vehicleId), () => loadVehiclePageData(vehicleId));
	if (vehicle === null) return notFoundHead(locale);

	const designation = vehicle.designation ?? m.vehicle_default_designation({}, { locale });

	return {
		title: m.page_title_vehicle_data(
			{ designation, networkName: vehicle.network.name, vehicleNumber: vehicle.number },
			{ locale },
		),
		description: m.page_description_vehicle(
			{ designation, network: getNetworkLabel(vehicle.network), vehicleNumber: vehicle.number },
			{ locale },
		),
		canonicalPath: null,
	};
}

async function resolveLineHead(lineId: number, subpath: string, locale: Locale) {
	const line = await findLineDetails(lineId);
	if (line === undefined) return notFoundHead(locale);

	const network = await findNetworkSummary(line.networkId);
	if (network === null) return notFoundHead(locale);

	if (subpath === "" || subpath === "/vehicle-assignments") {
		const lineLabel = getLineLabel(line, locale);
		const networkLabel = getNetworkLabel(network);
		return {
			title: m.page_title_line_data({ lineLabel, network: networkLabel }, { locale }),
			description: m.page_description_line({ lineLabel, network: networkLabel }, { locale }),
			canonicalPath: null,
		};
	}

	if (/^\/girouettes(?:\/new|\/\d+\/edit)?$/.test(subpath)) {
		return {
			title: m.line_girouettes_page_title({ lineNumber: line.number, networkName: network.name }, { locale }),
			canonicalPath: null,
		};
	}

	return notFoundHead(locale);
}

async function resolveEmbedHead(networkId: number, locale: Locale) {
	const network = await findNetworkSummary(networkId);
	if (network === null) return notFoundHead(locale);
	return { title: m.page_title_embed_map({ networkName: network.name }, { locale }), canonicalPath: null };
}

export async function resolvePageHead(path: string, search: URLSearchParams, locale: Locale): Promise<PageHead> {
	const normalizedPath = path.length > 1 ? path.replace(/\/+$/, "") : path;
	const matchId = (pattern: RegExp) => {
		const match = pattern.exec(normalizedPath);
		if (match === null) return undefined;
		const id = idSchema.safeParse(match[1]);
		return id.success ? { id: id.data, rest: match[2] ?? "" } : null;
	};

	if (normalizedPath === "/") return resolveMapHead(search, locale);

	if (normalizedPath === "/legal") {
		return { title: m.legal_page_title({}, { locale }), canonicalPath: "/legal" };
	}

	if (normalizedPath === "/attributions") {
		return {
			title: m.attributions_page_title({}, { locale }),
			description: m.page_description_attributions({}, { locale }),
			canonicalPath: "/attributions",
		};
	}

	if (normalizedPath === "/data") return resolveDataHead(search, locale);

	const network = matchId(/^\/data\/networks\/(\d+)$/);
	if (network !== undefined) return network === null ? notFoundHead(locale) : resolveNetworkHead(network.id, locale);

	const vehicle = matchId(/^\/data\/vehicles\/(\d+)$/);
	if (vehicle !== undefined) return vehicle === null ? notFoundHead(locale) : resolveVehicleHead(vehicle.id, locale);

	const line = matchId(/^\/data\/lines\/(\d+)(\/.*)?$/);
	if (line !== undefined) return line === null ? notFoundHead(locale) : resolveLineHead(line.id, line.rest, locale);

	const embed = matchId(/^\/embed\/(\d+)$/);
	if (embed !== undefined) return embed === null ? notFoundHead(locale) : resolveEmbedHead(embed.id, locale);

	return notFoundHead(locale);
}
