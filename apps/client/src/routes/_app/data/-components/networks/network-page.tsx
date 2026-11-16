import { useQuery } from "@tanstack/react-query";
import { RouteIcon } from "lucide-react";
import { parseAsStringEnum, useQueryState } from "nuqs";
import type { ReactNode } from "react";

import type { NetworkWithDetails } from "~/api/networks";
import { GetVehiclesQuery } from "~/api/vehicles";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { BusIcon } from "~/icons/means-of-transport";
import * as m from "~/paraglide/messages";
import { NetworkLines } from "~/routes/_app/data/-components/networks/network-lines";
import { NetworkVehicles } from "~/routes/_app/data/-components/networks/network-vehicles";
import { isActiveLine } from "~/utils/network-seo";

type NetworkPageProps = { network: NetworkWithDetails };

export function NetworkPage({ network }: Readonly<NetworkPageProps>) {
	const { hasVehiclesFeature } = network;
	const [tab, setTab] = useQueryState(
		"tab",
		parseAsStringEnum(["lines", "vehicles"]).withDefault(hasVehiclesFeature ? "vehicles" : "lines"),
	);
	const { data: vehicles } = useQuery({ ...GetVehiclesQuery(network.id), enabled: hasVehiclesFeature });

	// Un réseau qui ne suit pas son parc n'a rien à montrer côté véhicules : l'onglet reste
	// inatteignable, y compris via un `?tab=vehicles` recopié à la main.
	const activeTab = hasVehiclesFeature ? tab : "lines";

	const vehicleCount = vehicles?.filter((vehicle) => vehicle.archivedAt === null).length;
	const lineCount = network.lines.filter(isActiveLine).length;

	return (
		<Tabs className="gap-0" value={activeTab} onValueChange={(value) => setTab(value as typeof tab)}>
			<TabsList className="h-10 w-full justify-start border-b p-0 sm:gap-2" variant="line">
				<TabsTrigger
					className={tabTriggerClassName}
					disabled={!hasVehiclesFeature}
					title={hasVehiclesFeature ? undefined : m.network_vehicles_tab_unavailable()}
					value="vehicles"
				>
					<BusIcon className="size-4" /> {m.network_vehicles_tab()}
					{vehicleCount !== undefined && <TabCount>{vehicleCount}</TabCount>}
				</TabsTrigger>
				<TabsTrigger className={tabTriggerClassName} value="lines">
					<RouteIcon className="size-4" /> {m.network_lines_tab()}
					<TabCount>{lineCount}</TabCount>
				</TabsTrigger>
			</TabsList>

			{hasVehiclesFeature && (
				<TabsContent value="vehicles">
					<NetworkVehicles networkId={network.id} />
				</TabsContent>
			)}
			<TabsContent value="lines">
				<NetworkLines networkId={network.id} />
			</TabsContent>
		</Tabs>
	);
}

const tabTriggerClassName =
	"h-full flex-1 font-semibold sm:flex-none sm:px-4 group-data-[orientation=horizontal]/tabs:after:bottom-[-1px]";

function TabCount({ children }: Readonly<{ children: ReactNode }>) {
	return (
		<span className="rounded-full bg-muted px-1.5 py-px text-xs font-medium text-muted-foreground tabular-nums">
			<span aria-hidden="true">{children}</span>
			<span className="sr-only">({children})</span>
		</span>
	);
}
