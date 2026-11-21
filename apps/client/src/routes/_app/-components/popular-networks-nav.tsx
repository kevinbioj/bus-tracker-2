import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useId } from "react";

import { GetNetworksQuery } from "~/api/networks";
import * as m from "~/paraglide/messages";
import { getNetworkLabel } from "~/utils/network-seo";

export function PopularNetworksNav() {
	const headingId = useId();
	const { data: networks } = useQuery(GetNetworksQuery);

	if (networks === undefined) return null;

	const popularNetworks = networks
		.filter((network) => network.featuredOrder !== null)
		.toSorted((a, b) => a.featuredOrder! - b.featuredOrder!);
	if (popularNetworks.length === 0) return null;

	return (
		<nav
			aria-labelledby={headingId}
			className="sr-only focus-within:not-sr-only focus-within:fixed focus-within:bottom-3 focus-within:left-3 focus-within:z-500 focus-within:max-h-[60dvh] focus-within:overflow-y-auto focus-within:rounded-md focus-within:bg-popover focus-within:p-3 focus-within:text-popover-foreground focus-within:shadow-lg"
		>
			<h2 className="font-bold mb-1" id={headingId}>
				{m.map_popular_networks()}
			</h2>
			<ul>
				{popularNetworks.map((network) => (
					<li key={network.id}>
						<Link className="underline" search={{ "network-id": network.id }} to="/">
							{m.map_popular_network_link({ network: getNetworkLabel(network) })}
						</Link>
					</li>
				))}
			</ul>
		</nav>
	);
}
