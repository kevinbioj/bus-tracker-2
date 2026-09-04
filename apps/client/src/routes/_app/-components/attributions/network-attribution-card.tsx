import { Link } from "@tanstack/react-router";
import { ArrowRightIcon } from "lucide-react";

import type { NetworkDataSources } from "~/api/data-sources";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { DataSourceItem } from "~/routes/_app/-components/attributions/data-source-item";

type NetworkAttributionCardProps = {
	entry: NetworkDataSources;
};

export function NetworkAttributionCard({ entry }: Readonly<NetworkAttributionCardProps>) {
	const { network, sources } = entry;

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center justify-between gap-3">
					<div className="flex items-center gap-3 min-w-0">
						{network.logoHref !== null && (
							<picture className="shrink-0">
								{network.darkModeLogoHref !== null && (
									<source srcSet={network.darkModeLogoHref} media="(prefers-color-scheme: dark)" />
								)}
								<img alt="" className="h-8 max-w-24 object-contain" src={network.logoHref} />
							</picture>
						)}
						<div className="min-w-0">
							<h3 className="font-bold text-base leading-tight truncate">{network.name}</h3>
							{network.authority !== null && (
								<p className="text-xs text-muted-foreground truncate">{network.authority}</p>
							)}
						</div>
					</div>
					<Link
						aria-label={network.name}
						className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
						params={{ networkId: String(network.id) }}
						to="/data/networks/$networkId"
					>
						<ArrowRightIcon className="size-5" />
					</Link>
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-2">
				{sources.map((dataSource) => (
					<DataSourceItem dataSource={dataSource} key={dataSource.id} />
				))}
			</CardContent>
		</Card>
	);
}
