import type { ReactNode } from "react";

import type { Network } from "~/api/networks";
import { TitleSeparator } from "~/components/ui/title-separator";
import { NetworkCard } from "~/pages/network-list/network-card";

type NetworksBlockProps = {
	title: ReactNode;
	networks: Network[];
};

export function NetworksBlock({ title, networks }: NetworksBlockProps) {
	return (
		<div>
			<TitleSeparator className="flex items-center gap-2 text-base">{title}</TitleSeparator>
			<ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
				{networks.map((network) => (
					<li key={network.id}>
						<NetworkCard key={network.id} network={network} />
					</li>
				))}
			</ul>
		</div>
	);
}
