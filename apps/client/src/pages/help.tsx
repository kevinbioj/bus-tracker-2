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

export function HelpPage() {
	return (
		<>
			<title>Aide & FAQ – Bus Tracker</title>
			<main className="p-3 max-w-(--breakpoint-xl) w-full mx-auto space-y-4">
				<div>
					<h2 className="font-bold text-2xl">Aide & FAQ</h2>
					<p className="text-muted-foreground">Tout ce qu'il faut savoir pour bien utiliser l'application.</p>
					<Separator />
				</div>

				{/* 1. Qu'est-ce que Bus Tracker ? */}
				<section className="space-y-4">
					<h3 className="font-bold text-xl">1. Qu'est-ce que Bus Tracker ?</h3>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<Card className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900/50">
							<CardHeader className="pb-2">
								<CardTitle className="text-red-600 dark:text-red-400 flex items-center gap-2 text-lg">
									<XCircleIcon className="size-5" /> Ce n'est pas
								</CardTitle>
							</CardHeader>
							<CardContent className="text-sm space-y-2">
								<p>Un calculateur d'itinéraire d'un point A vers un point B.</p>
								<p>L'application officielle de votre réseau de transport.</p>
							</CardContent>
						</Card>
						<Card className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900/50">
							<CardHeader className="pb-2">
								<CardTitle className="text-green-600 dark:text-green-400 flex items-center gap-2 text-lg">
									<CheckCircle2Icon className="size-5" /> C'est
								</CardTitle>
							</CardHeader>
							<CardContent className="text-sm space-y-2">
								<p>Un moyen simple et rapide de voir où se situe son bus.</p>
								<p>Un outil ludique pour visualiser l'activité globale d'un réseau.</p>
								<p>Un observatoire des données d'activité (historique, affectations).</p>
							</CardContent>
						</Card>
					</div>
				</section>

				{/* 2. Comment interpréter les positions ? */}
				<section className="space-y-4">
					<h3 className="font-bold text-xl">2. Comment interpréter les positions ?</h3>
					<div className="space-y-4">
						<div className="grid grid-cols-1 gap-4">
							<div className="space-y-3">
								<h4 className="font-semibold flex items-center gap-2 text-muted-foreground">
									<SatelliteDishIcon className="size-5" /> La couleur du satellite
								</h4>
								<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
									<div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
										<SatelliteDishIcon className="text-green-600 shrink-0" />
										<div className="text-xs">
											<p className="font-bold">GPS</p>
											<p className="text-muted-foreground">Position réelle (GPS du bus)</p>
										</div>
									</div>
									<div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
										<SatelliteDishIcon className="text-orange-500 shrink-0" />
										<div className="text-xs">
											<p className="font-bold">Estimé</p>
											<p className="text-muted-foreground">Calculé via les horaires temps réel</p>
										</div>
									</div>
									<div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
										<SatelliteDishIcon className="text-red-600 shrink-0" />
										<div className="text-xs">
											<p className="font-bold">Théorique</p>
											<p className="text-muted-foreground">Horaires sans aucun temps réel</p>
										</div>
									</div>
								</div>
							</div>

							<div className="space-y-2">
								<h4 className="font-semibold flex items-center gap-2 text-muted-foreground">
									<ClockIcon className="size-5" /> Fraîcheur des données
								</h4>
								<p className="text-sm leading-relaxed">
									Une position peut dater de plusieurs minutes si elle n'est pas rafraîchie à temps par l'opérateur.
									L'application affiche la <strong>date de relevé</strong> transmise dans les détails du véhicule.
								</p>
							</div>
						</div>
					</div>
				</section>

				{/* 3. Disponibilité du temps réel */}
				<section className="space-y-4">
					<h3 className="font-bold text-xl">3. Disponibilité du temps réel</h3>
					<Card className="bg-blue-50 border-blue-100 dark:bg-blue-950/20 dark:border-blue-900/50">
						<CardContent className="p-4 flex gap-4">
							<WifiIcon className="size-8 text-blue-600 shrink-0" />
							<div className="text-sm space-y-2">
								<p>
									Le temps réel dépend intégralement du bon vouloir des réseaux et de la qualité technique de leurs flux
									de données.
								</p>
								<p>
									Si le temps réel est indisponible, ce n'est que rarement imputable à Bus Tracker. L'application ne
									fait qu'afficher les données transmises par les opérateurs.
								</p>
							</div>
						</CardContent>
					</Card>
				</section>

				{/* 4. Nouveaux réseaux */}
				<section className="space-y-4">
					<h3 className="font-bold text-xl">4. Nouveaux réseaux</h3>
					<div className="space-y-4">
						<p className="text-sm leading-relaxed">
							Toute suggestion d'ajout de réseau doit être faite sur le serveur Discord dédié.
						</p>
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<Card>
								<CardHeader className="pb-2">
									<CardTitle className="text-lg flex items-center gap-2">
										<PlusCircleIcon className="size-5 text-primary" /> Priorisation
									</CardTitle>
								</CardHeader>
								<CardContent className="text-sm">
									L'application est gourmande en ressources. Les réseaux sont ajoutés selon l'intérêt général et la
									faisabilité technique.
								</CardContent>
							</Card>
							<Card>
								<CardHeader className="pb-2">
									<CardTitle className="text-lg flex items-center gap-2">
										<AlertTriangleIcon className="size-5 text-amber-500" /> Pas d'obligation
									</CardTitle>
								</CardHeader>
								<CardContent className="text-sm">
									L'ajout d'un réseau suggéré n'est pas systématique. La décision finale reste à la discrétion de
									l'éditeur.
								</CardContent>
							</Card>
						</div>
					</div>
				</section>
			</main>
		</>
	);
}
