import { useSuspenseQuery } from "@tanstack/react-query";
import { SearchIcon } from "lucide-react";
import type { ComponentProps } from "react";

import { GetRegionsQuery } from "~/api/regions";
import { Input } from "~/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import * as m from "~/paraglide/messages";
import {
	ALL_REGIONS_FILTER,
	isSpecialRegionFilter,
	OTHER_REGIONS_FILTER,
	toRegionFilter,
} from "~/routes/_app/data/-networks-list/region-filter";
import { useNetworksListSearchQuery } from "~/routes/_app/data/-networks-list/use-search-query";
import { cn } from "~/utils/cn";

export function NetworksListHeaderBlock({ className, ...props }: ComponentProps<"div">) {
	const { data: regions } = useSuspenseQuery(GetRegionsQuery);
	const [searchQuery, setSearchQuery] = useNetworksListSearchQuery();
	const [regionFilter, setRegionFilter] = useNetworksListSearchQuery("region");
	const parsedRegionFilter = toRegionFilter(regionFilter);
	const selectedRegionFilter =
		isSpecialRegionFilter(parsedRegionFilter) || regions.some((region) => String(region.id) === parsedRegionFilter)
			? parsedRegionFilter
			: ALL_REGIONS_FILTER;
	const selectedRegionLabel =
		selectedRegionFilter === ALL_REGIONS_FILTER
			? m.networks_list_region_all()
			: selectedRegionFilter === OTHER_REGIONS_FILTER
				? m.map_network_other()
				: regions.find((region) => String(region.id) === selectedRegionFilter)?.name;

	return (
		<div className={cn("bg-background z-1", className)} {...props}>
			<div className="max-w-(--breakpoint-xl) mx-auto p-3">
				<div className="mb-2">
					<h1 className="font-bold text-2xl">{m.networks_list_title()}</h1>
					<p className="text-muted-foreground">{m.networks_list_description()}</p>
				</div>
				<div className="flex flex-col gap-2 sm:flex-row">
					<div className="relative min-w-0 flex-1">
						<SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
						<Input
							className="pl-9"
							placeholder={m.networks_list_search_placeholder()}
							value={searchQuery ?? ""}
							onChange={(e) => setSearchQuery(e.target.value || null)}
						/>
					</div>
					<Select
						value={selectedRegionFilter}
						onValueChange={(value) => setRegionFilter(value === ALL_REGIONS_FILTER ? null : toRegionFilter(value))}
					>
						<SelectTrigger aria-label={m.networks_list_region_filter_label()} className="w-full sm:w-56">
							<SelectValue
								className={selectedRegionFilter === ALL_REGIONS_FILTER ? "text-muted-foreground" : undefined}
							>
								{selectedRegionLabel}
							</SelectValue>
						</SelectTrigger>
						<SelectContent className="w-fit min-w-56">
							<SelectGroup>
								<SelectItem className="text-muted-foreground" value={ALL_REGIONS_FILTER}>
									{m.networks_list_region_all()}
								</SelectItem>
								{regions.map((region) => (
									<SelectItem key={region.id} value={String(region.id)}>
										{region.name}
									</SelectItem>
								))}
								<SelectItem value={OTHER_REGIONS_FILTER}>{m.map_network_other()}</SelectItem>
							</SelectGroup>
						</SelectContent>
					</Select>
				</div>
			</div>
		</div>
	);
}
