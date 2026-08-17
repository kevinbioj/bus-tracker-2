import { RouteIcon } from "lucide-react";
import { parseAsStringEnum, useQueryState } from "nuqs";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { BusIcon } from "~/icons/means-of-transport";
import * as m from "~/paraglide/messages";
import { NetworkLines } from "~/routes/_app/data/-components/networks/network-lines";
import { NetworkVehicles } from "~/routes/_app/data/-components/networks/network-vehicles";

type NetworkVehiclesProps = { hasVehiclesFeature: boolean; networkId: number };

export function NetworkPage({ hasVehiclesFeature, networkId }: Readonly<NetworkVehiclesProps>) {
	const [tab, setTab] = useQueryState(
		"tab",
		parseAsStringEnum(["lines", "vehicles"]).withDefault(hasVehiclesFeature ? "vehicles" : "lines"),
	);

	// Un réseau qui ne suit pas son parc n'a rien à montrer côté véhicules : l'onglet reste
	// inatteignable, y compris via un `?tab=vehicles` recopié à la main.
	const activeTab = hasVehiclesFeature ? tab : "lines";

	return (
		<Tabs className="gap-0 mt-1" value={activeTab} onValueChange={(value) => setTab(value as typeof tab)}>
			<TabsList className="grid grid-cols-2 w-full">
				<TabsTrigger
					value="vehicles"
					className="flex items-center gap-1.5 font-bold"
					disabled={!hasVehiclesFeature}
					title={hasVehiclesFeature ? undefined : m.network_vehicles_tab_unavailable()}
				>
					<BusIcon className="size-4" /> {m.network_vehicles_tab()}
				</TabsTrigger>
				<TabsTrigger value="lines" className="flex items-center gap-1.5 font-bold">
					<RouteIcon className="size-4" /> {m.network_lines_tab()}
				</TabsTrigger>
			</TabsList>

			{hasVehiclesFeature && (
				<TabsContent value="vehicles">
					<NetworkVehicles networkId={networkId} />
				</TabsContent>
			)}
			<TabsContent value="lines">
				<NetworkLines networkId={networkId} />
			</TabsContent>
		</Tabs>
	);
}
