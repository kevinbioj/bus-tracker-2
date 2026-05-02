import type { ReactNode } from "react";

import type { Network } from "~/api/networks";
import { TitleSeparator } from "~/components/ui/title-separator";
import { NetworksListCard } from "~/routes/_app/data/-networks-list/network-card";

type NetworksListBlockProps = {
	title: ReactNode;
	networks: Network[];
};

export function NetworksListBlock({ title, networks }: NetworksListBlockProps) {
	return (
		<section className="flex flex-col gap-2">
			<TitleSeparator TitleComponent="h2" className="flex items-center gap-2 text-base">
				{title}
			</TitleSeparator>
			<ul className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
				{networks.map((network) => (
					<li key={network.id}>
						<NetworksListCard network={network} />
					</li>
				))}
			</ul>
		</section>
	);
}
