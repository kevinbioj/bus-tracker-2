import { RouteIcon } from "lucide-react";
import { parseAsStringEnum, useQueryState } from "nuqs";

import { NetworkLines } from "~/components/data/networks/network-lines";
import { NetworkVehicles } from "~/components/data/networks/network-vehicles";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { BusIcon } from "~/icons/means-of-transport";

type NetworkVehiclesProps = { networkId: number };

export function NetworkPage({ networkId }: Readonly<NetworkVehiclesProps>) {
	const [tab, setTab] = useQueryState("tab", parseAsStringEnum(["lines", "vehicles"]).withDefault("vehicles"));

	return (
		<section>
			<Tabs className="w-full" value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
				<TabsList className="grid w-full grid-cols-2 mb-2">
					<TabsTrigger value="vehicles" className="flex items-center gap-1.5 font-bold">
						<BusIcon className="size-4" /> Véhicules
					</TabsTrigger>
					<TabsTrigger value="lines" className="flex items-center gap-1.5 font-bold">
						<RouteIcon className="size-4" /> Lignes
					</TabsTrigger>
				</TabsList>

				<TabsContent value="vehicles">
					<NetworkVehicles networkId={networkId} />
				</TabsContent>
				<TabsContent value="lines">
					<NetworkLines networkId={networkId} />
				</TabsContent>
			</Tabs>
		</section>
	);
}
