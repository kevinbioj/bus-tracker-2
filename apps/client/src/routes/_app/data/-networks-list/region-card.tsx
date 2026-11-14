import { Link } from "@tanstack/react-router";
import { ChevronRightIcon } from "lucide-react";

import type { Network } from "~/api/networks";
import * as m from "~/paraglide/messages";
import { cardClassName } from "~/routes/_app/data/-networks-list/card-list";
import { NetworkLogo } from "~/routes/_app/data/-networks-list/network-logo";
import type { RegionGroup } from "~/routes/_app/data/-networks-list/use-networks-list-view";
import { cn } from "~/utils/cn";

const PREVIEW_LOGO_COUNT = 3;

function pickPreviewNetworks(networks: Network[]) {
	const logos = new Set<string>();
	const preview: Network[] = [];

	for (const network of networks) {
		if (network.logoHref === null || logos.has(network.logoHref)) continue;

		logos.add(network.logoHref);
		preview.push(network);
		if (preview.length === PREVIEW_LOGO_COUNT) break;
	}

	return preview;
}

export function NetworksListRegionCard({ group }: Readonly<{ group: RegionGroup }>) {
	const previewNetworks = pickPreviewNetworks(group.networks);
	const networkCount = m.map_region_network_count({ count: group.networks.length });

	return (
		<Link
			aria-label={`${group.title}, ${networkCount}`}
			className={cn(cardClassName, "flex h-full min-h-14 items-center gap-3 px-3 py-2 sm:min-h-16")}
			search={{ region: group.region.id }}
			to="/data"
		>
			<span aria-hidden="true" className="grid min-w-0 flex-1 gap-0.5">
				<span className="line-clamp-2 font-semibold leading-tight">{group.title}</span>
				<span className="truncate text-xs leading-tight text-muted-foreground">{networkCount}</span>
			</span>
			<span aria-hidden="true" className="flex shrink-0 items-center gap-1">
				{previewNetworks.map((network, index) => (
					<NetworkLogo
						className={cn("h-7 w-10 sm:h-8 sm:w-12", index === PREVIEW_LOGO_COUNT - 1 && "max-[400px]:hidden")}
						key={network.id}
						network={network}
					/>
				))}
			</span>
			<ChevronRightIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
		</Link>
	);
}
