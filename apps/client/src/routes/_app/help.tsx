import { createFileRoute } from "@tanstack/react-router";
import {
	AlertTriangleIcon,
	CheckCircle2Icon,
	ClockIcon,
	PlusCircleIcon,
	SatelliteDishIcon,
	WifiIcon,
	XCircleIcon,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import * as m from "~/paraglide/messages";

export const Route = createFileRoute("/_app/help")({
	component: HelpPage,
});

function HelpPage() {
	return (
		<>
			<title>{m.help_page_title()}</title>
			<main className="p-3 max-w-(--breakpoint-xl) w-full mx-auto space-y-4">
				<div>
					<h2 className="font-bold text-2xl">{m.help_title()}</h2>
					<p className="text-muted-foreground">{m.help_intro()}</p>
					<Separator />
				</div>

				{/* 1. Qu'est-ce que Bus Tracker ? */}
				<section className="space-y-4">
					<h3 className="font-bold text-xl">{m.help_what_title()}</h3>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<Card className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900/50">
							<CardHeader className="pb-2">
								<CardTitle className="text-red-600 dark:text-red-400 flex items-center gap-2 text-lg">
									<XCircleIcon className="size-5" /> {m.help_not_title()}
								</CardTitle>
							</CardHeader>
							<CardContent className="text-sm space-y-2">
								<p>{m.help_not_route_planner()}</p>
								<p>{m.help_not_official_app()}</p>
							</CardContent>
						</Card>
						<Card className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900/50">
							<CardHeader className="pb-2">
								<CardTitle className="text-green-600 dark:text-green-400 flex items-center gap-2 text-lg">
									<CheckCircle2Icon className="size-5" /> {m.help_is_title()}
								</CardTitle>
							</CardHeader>
							<CardContent className="text-sm space-y-2">
								<p>{m.help_is_bus_location()}</p>
								<p>{m.help_is_network_activity()}</p>
								<p>{m.help_is_data_observatory()}</p>
							</CardContent>
						</Card>
					</div>
				</section>

				{/* 2. Comment interpréter les positions ? */}
				<section className="space-y-4">
					<h3 className="font-bold text-xl">{m.help_positions_title()}</h3>
					<div className="space-y-4">
						<div className="grid grid-cols-1 gap-4">
							<div className="space-y-3">
								<h4 className="font-semibold flex items-center gap-2 text-muted-foreground">
									<SatelliteDishIcon className="size-5" /> {m.help_satellite_color()}
								</h4>
								<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
									<div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
										<SatelliteDishIcon className="text-green-600 shrink-0" />
										<div className="text-xs">
											<p className="font-bold">{m.help_position_gps()}</p>
											<p className="text-muted-foreground">{m.help_position_gps_description()}</p>
										</div>
									</div>
									<div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
										<SatelliteDishIcon className="text-orange-500 shrink-0" />
										<div className="text-xs">
											<p className="font-bold">{m.help_position_estimated()}</p>
											<p className="text-muted-foreground">{m.help_position_estimated_description()}</p>
										</div>
									</div>
									<div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
										<SatelliteDishIcon className="text-red-600 shrink-0" />
										<div className="text-xs">
											<p className="font-bold">{m.help_position_theoretical()}</p>
											<p className="text-muted-foreground">{m.help_position_theoretical_description()}</p>
										</div>
									</div>
								</div>
							</div>

							<div className="space-y-2">
								<h4 className="font-semibold flex items-center gap-2 text-muted-foreground">
									<ClockIcon className="size-5" /> {m.help_data_freshness()}
								</h4>
								<p className="text-sm leading-relaxed">{m.help_data_freshness_text()}</p>
							</div>
						</div>
					</div>
				</section>

				{/* 3. Disponibilité du temps réel */}
				<section className="space-y-4">
					<h3 className="font-bold text-xl">{m.help_realtime_title()}</h3>
					<Card className="bg-blue-50 border-blue-100 dark:bg-blue-950/20 dark:border-blue-900/50">
						<CardContent className="p-4 flex gap-4">
							<WifiIcon className="size-8 text-blue-600 shrink-0" />
							<div className="text-sm space-y-2">
								<p>{m.help_realtime_depends()}</p>
								<p>{m.help_realtime_unavailable()}</p>
							</div>
						</CardContent>
					</Card>
				</section>

				{/* 4. Nouveaux réseaux */}
				<section className="space-y-4">
					<h3 className="font-bold text-xl">{m.help_new_networks_title()}</h3>
					<div className="space-y-4">
						<p className="text-sm leading-relaxed">{m.help_new_networks_discord()}</p>
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<Card>
								<CardHeader className="pb-2">
									<CardTitle className="text-lg flex items-center gap-2">
										<PlusCircleIcon className="size-5 text-green-600" /> {m.help_prioritization_title()}
									</CardTitle>
								</CardHeader>
								<CardContent className="text-sm">{m.help_prioritization_text()}</CardContent>
							</Card>
							<Card>
								<CardHeader className="pb-2">
									<CardTitle className="text-lg flex items-center gap-2">
										<AlertTriangleIcon className="size-5 text-amber-500" /> {m.help_no_obligation_title()}
									</CardTitle>
								</CardHeader>
								<CardContent className="text-sm">{m.help_no_obligation_text()}</CardContent>
							</Card>
						</div>
					</div>
				</section>
			</main>
		</>
	);
}
