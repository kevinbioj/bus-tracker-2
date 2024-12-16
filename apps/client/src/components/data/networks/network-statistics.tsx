import { useSuspenseQuery } from "@tanstack/react-query";
import { LucideChartLine } from "lucide-react";

import { GetNetworkStatsQuery } from "~/api/networks";
import { Card, CardContent, CardTitle } from "~/components/ui/card";

type NetworkStatisticsProps = { networkId: number };

export function NetworkStatistics({ networkId }: Readonly<NetworkStatisticsProps>) {
	const { data: stats } = useSuspenseQuery(GetNetworkStatsQuery(networkId));

	return (
		<section className="py-2">
			<h3 className="inline-flex gap-2 text-lg">
				<LucideChartLine /> Statistiques
			</h3>
			<div className="grid grid-cols-2 gap-3">
				<Card>
					<CardTitle className="mt-5 mb-3 text-center">{stats.ongoingJourneyCount || "Aucune"}</CardTitle>
					<CardContent className="text-center text-sm">
						course{stats.ongoingJourneyCount > 1 ? "s" : ""} en activité
					</CardContent>
				</Card>
				<Card>
					<CardTitle className="mt-5 mb-3 text-center">
						{stats.onlineVehicleCount || "Aucun"}
						<span className="font-normal text-lg">/{stats.totalVehicleCount}</span>
					</CardTitle>
					<CardContent className="text-center text-sm">
						véhicule{stats.onlineVehicleCount > 1 ? "s" : ""} en ligne
					</CardContent>
				</Card>
			</div>
		</section>
	);
}
