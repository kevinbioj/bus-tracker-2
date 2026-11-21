import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { z } from "zod";

import { GetLineQuery } from "~/api/lines";
import { GetNetworkQuery } from "~/api/networks";
import { BreadcrumbJsonLd, Canonical, NoIndex } from "~/components/seo";
import { lineIdsSearchParser, resolveFilteredLines } from "~/components/vehicles-map/filter-module/map-filter";
import { VehiclesMap } from "~/components/vehicles-map/vehicles-map";
import * as m from "~/paraglide/messages";
import { PopularNetworksNav } from "~/routes/_app/-components/popular-networks-nav";
import { getLineLabel } from "~/routes/_app/data/-components/lines/line-identity";
import { formatNetworkModes, getNetworkLabel, isActiveLine } from "~/utils/network-seo";

const searchSchema = z.object({
	"line-id": z.union([z.number(), z.string()]).optional(),
	"network-id": z.coerce.number().optional(),
	"marker-id": z.string().optional(),
	from_old: z.string().optional(),
});

function parseLineIds(value: number | string | undefined) {
	if (value === undefined) return undefined;
	const lineIds = lineIdsSearchParser.parse(String(value));
	return lineIds !== null && lineIds.length > 0 ? lineIds : undefined;
}

export const Route = createFileRoute("/_app/")({
	component: MapPage,
	validateSearch: searchSchema,
});

type MapPageHead = {
	title: string;
	description: string;
	heading: string;
	canonicalPath: string | null;
	breadcrumb?: { name: string; path: string }[];
};

const defaultHead = (canonicalPath: string | null): MapPageHead => ({
	title: m.page_title_map(),
	description: m.page_description_map(),
	heading: m.map_page_heading(),
	canonicalPath,
});

function useMapPageHead(): MapPageHead | undefined {
	const rawLineIds = Route.useSearch({ select: (search) => search["line-id"] });
	const networkId = Route.useSearch({ select: (search) => search["network-id"] });

	const lineIds = useMemo(() => parseLineIds(rawLineIds), [rawLineIds]);
	const lineId = lineIds?.[0];
	const lineQuery = useQuery(GetLineQuery(lineId));
	const filteredNetworkId = lineId === undefined ? networkId : lineQuery.data?.networkId;
	const networkQuery = useQuery(GetNetworkQuery(filteredNetworkId, true));
	const network = networkQuery.data?.id === filteredNetworkId ? networkQuery.data : undefined;

	if (lineId === undefined && networkId === undefined) return defaultHead("/");

	if (lineQuery.isError || networkQuery.isError) return defaultHead(null);
	if (network === undefined) return undefined;

	const networkLabel = getNetworkLabel(network);

	if (lineIds !== undefined) {
		const lines = resolveFilteredLines(network.lines, lineIds);
		const lineLabel =
			lines.length > 0
				? lines.map(getLineLabel).join(", ")
				: lineQuery.data !== undefined
					? getLineLabel(lineQuery.data)
					: undefined;
		if (lineLabel === undefined) return undefined;

		return {
			title: m.page_title_map_line({ lineLabel, networkName: network.name }),
			description: m.page_description_map_line({ lineLabel, network: networkLabel }),
			heading: m.map_page_heading_line({ lineLabel, network: networkLabel }),
			canonicalPath: null,
		};
	}

	const modes = formatNetworkModes(network.lines);
	const canonicalPath = network.lines.some(isActiveLine) ? `/?network-id=${network.id}` : null;
	return {
		title: m.page_title_map_network({ modes, networkName: network.name }),
		description: m.page_description_map_network({ modes, network: networkLabel }),
		heading: m.map_page_heading_network({ modes, network: networkLabel }),
		canonicalPath,
		breadcrumb:
			canonicalPath === null
				? undefined
				: [
						{ name: "Bus Tracker", path: "/" },
						{ name: networkLabel, path: canonicalPath },
					],
	};
}

function MapPage() {
	const head = useMapPageHead();

	return (
		<>
			{head !== undefined && (
				<>
					<title>{head.title}</title>
					<meta content={head.description} name="description" />
					{head.canonicalPath === null ? <NoIndex /> : <Canonical path={head.canonicalPath} />}
					{head.breadcrumb !== undefined && <BreadcrumbJsonLd items={head.breadcrumb} />}
				</>
			)}
			<style>{` body { background-color: var(--color-branding); } `}</style>
			<main>
				<h1 className="sr-only">{head?.heading ?? m.map_page_heading()}</h1>
				<VehiclesMap className="h-[calc(100dvh-56px)]" />
				{head?.canonicalPath === "/" && <PopularNetworksNav />}
			</main>
		</>
	);
}
