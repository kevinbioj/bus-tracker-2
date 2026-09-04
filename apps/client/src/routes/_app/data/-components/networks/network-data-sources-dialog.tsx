import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { LucideInfo } from "lucide-react";

import { GetNetworkDataSourcesQuery } from "~/api/data-sources";
import { Button } from "~/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import * as m from "~/paraglide/messages";
import { DataSourceItem } from "~/routes/_app/-components/attributions/data-source-item";

type NetworkDataSourcesDialogProps = {
	networkId: number;
};

/**
 * Sources alimentant le réseau, ouvertes depuis l'en-tête. Le bouton reste absent tant qu'aucune
 * source n'est connue : tous les réseaux ne proviennent pas d'un provider qui les déclare.
 */
export function NetworkDataSourcesDialog({ networkId }: Readonly<NetworkDataSourcesDialogProps>) {
	const { data: dataSources } = useQuery(GetNetworkDataSourcesQuery(networkId));

	if (dataSources === undefined || dataSources.length === 0) return null;

	return (
		<Dialog>
			<DialogTrigger
				render={
					<Button size="icon-sm" variant="outline" title={m.network_data_sources_title()}>
						<LucideInfo aria-label={m.network_data_sources_title()} />
					</Button>
				}
			/>
			{/* Seule la liste défile : le titre et le bouton de fermeture restent atteignables, ce qui
			    compte surtout sur mobile où la fenêtre occupe toute la largeur. */}
			<DialogContent
				aria-describedby={undefined}
				className="max-h-[95dvh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden"
			>
				<DialogHeader className="pr-8">
					<DialogTitle>{m.network_data_sources_title()}</DialogTitle>
				</DialogHeader>
				<div className="space-y-2 overflow-y-auto">
					{dataSources.map((dataSource) => (
						<DataSourceItem dataSource={dataSource} key={dataSource.id} />
					))}
				</div>
				<p className="text-sm text-muted-foreground">
					<DialogClose nativeButton={false} render={<Link to="/attributions">{m.attributions_see_all()}</Link>} />
				</p>
			</DialogContent>
		</Dialog>
	);
}
