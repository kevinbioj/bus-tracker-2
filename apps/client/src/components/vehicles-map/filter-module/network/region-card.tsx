import { ChevronRightIcon } from "lucide-react";
import { useMemo } from "react";

import type { Network } from "~/api/networks";
import { NetworkLogoTile } from "~/components/vehicles-map/filter-module/network/network-logo";
import * as m from "~/paraglide/messages";
import { cn } from "~/utils/cn";

export type RegionGroup = {
	key: string;
	title: string;
	networks: Network[];
};

const PREVIEW_LOGO_COUNT = 3;

type FilterModuleRegionCardProps = {
	region: RegionGroup;
	onClick: () => void;
};

export function FilterModuleRegionCard({ region, onClick }: Readonly<FilterModuleRegionCardProps>) {
	const previewNetworks = useMemo(
		() => region.networks.filter((network) => network.logoHref !== null).slice(0, PREVIEW_LOGO_COUNT),
		[region.networks],
	);
	const networkCount = m.map_region_network_count({ count: region.networks.length });

	return (
		<div className="h-full px-2 py-0.5">
			<button
				aria-label={`${region.title}, ${networkCount}`}
				className="flex h-full w-full items-center gap-3 rounded-lg px-2 text-left transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-branding/50"
				onClick={onClick}
				type="button"
			>
				<span aria-hidden="true" className="grid min-w-0 flex-1 gap-0.5">
					<span className="truncate text-sm font-semibold leading-tight">{region.title}</span>
					<span className="truncate text-xs leading-tight text-muted-foreground">{networkCount}</span>
				</span>
				<span aria-hidden="true" className="flex shrink-0 items-center gap-1">
					{previewNetworks.map((network, index) => (
						<NetworkLogoTile
							className={cn("h-7 w-10", index === PREVIEW_LOGO_COUNT - 1 && "max-[400px]:hidden")}
							key={network.id}
							network={network}
						/>
					))}
				</span>
				<ChevronRightIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
			</button>
		</div>
	);
}
