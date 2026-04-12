import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Link } from "~/components/ui/link";
import { Separator } from "~/components/ui/separator";

export function LegalPage() {
	return (
		<>
			<title>Mentions légales – Bus Tracker</title>
			<main className="p-3 max-w-(--breakpoint-xl) w-full mx-auto space-y-4">
				<div className="flex flex-col gap-2">
					<h2 className="font-bold text-2xl">Mentions légales & Politique de confidentialité</h2>
					<p className="text-muted-foreground text-sm uppercase tracking-widest">Dernière mise à jour : Mars 2026</p>
					<Separator />
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
					<div className="space-y-8">
						{/* Section 1: Édition */}
						<section className="space-y-3">
							<h3 className="font-bold text-xl flex items-center gap-2">
								<span className="bg-primary text-primary-foreground rounded-full size-6 inline-flex items-center justify-center text-xs">
									1
								</span>{" "}
								Édition du site
							</h3>
							<div className="space-y-3">
								<p className="leading-relaxed">
									Le présent site est édité à des fins non professionnelles par un particulier, agissant dans le cadre
									d'une activité de loisir.
								</p>
								<Card className="bg-muted/50 border-none shadow-none">
									<CardContent className="p-4 pt-4 italic text-sm text-muted-foreground leading-relaxed">
										Conformément aux dispositions de l'article 6, III, 2° de la loi n° 2004-575 du 21 juin 2004 (LCEN),
										l'éditeur a choisi de rester <strong>anonyme</strong>. Les coordonnées personnelles ont été
										transmises en bonne et due forme à l'hébergeur.
									</CardContent>
								</Card>
								<p className="flex items-center gap-2">
									<span className="font-semibold">Contact :</span>
									<Link to="mailto:contact@bus-tracker.fr" className="underline">
										contact@bus-tracker.fr
									</Link>
								</p>
							</div>
						</section>

						{/* Section 2: Hébergement */}
						<section className="space-y-3">
							<h3 className="font-bold text-xl flex items-center gap-2">
								<span className="bg-primary text-primary-foreground rounded-full size-6 inline-flex items-center justify-center text-xs">
									2
								</span>{" "}
								Hébergement
							</h3>
							<Card>
								<CardHeader className="p-4 pb-2">
									<CardTitle className="text-lg font-bold uppercase">YorkHost SAS</CardTitle>
								</CardHeader>
								<CardContent className="p-4 pt-0 space-y-1 text-sm">
									<p>20 rue Jacques Louis Duvivier</p>
									<p>78520 Limay, France</p>
									<div className="pt-2 flex flex-col gap-1">
										<p>
											<span className="font-medium text-muted-foreground">E-mail :</span> contact[at]yorkhost.fr
										</p>
										<p>
											<span className="font-medium text-muted-foreground">Site :</span>{" "}
											<Link to="https://www.yorkhost.fr" target="_blank" className="underline">
												www.yorkhost.fr
											</Link>
										</p>
									</div>
								</CardContent>
							</Card>
						</section>
					</div>

					<div className="space-y-8">
						{/* Section 3: Propriété Intellectuelle */}
						<section className="space-y-3">
							<h3 className="font-bold text-xl flex items-center gap-2">
								<span className="bg-primary text-primary-foreground rounded-full size-6 inline-flex items-center justify-center text-xs">
									3
								</span>{" "}
								Propriété Intellectuelle
							</h3>
							<div className="space-y-4">
								<div className="space-y-2">
									<p className="text-sm leading-relaxed">
										Le code source est mis à disposition sous licence <strong>GNU General Public License v3.0</strong>.
										Vous êtes libre de le consulter et de le modifier selon les termes de cette licence sur{" "}
										<Link className="underline" to="https://github.com/kevinbioj/bus-tracker-2" target="_blank">
											GitHub
										</Link>
										.
									</p>
								</div>
								<Card className="bg-amber-500/10 border-amber-500/20 shadow-none">
									<CardContent className="p-4 pt-4 space-y-2">
										<h4 className="font-semibold text-amber-900 dark:text-amber-200">Contenus & Identité Visuelle</h4>
										<p className="text-amber-800 dark:text-amber-300 text-sm leading-relaxed">
											L'accès au code source ne confère aucun droit sur les contenus rédactionnels, le logo ou la charte
											graphique.
											<br />
											<strong className="underline decoration-amber-500/50">
												La copie servile du site ou de son identité visuelle est strictement interdite.
											</strong>
										</p>
									</CardContent>
								</Card>
							</div>
						</section>

						{/* Section 4: RGPD */}
						<section className="space-y-3">
							<h3 className="font-bold text-xl flex items-center gap-2">
								<span className="bg-primary text-primary-foreground rounded-full size-6 inline-flex items-center justify-center text-xs">
									4
								</span>{" "}
								Confidentialité (RGPD)
							</h3>
							<div className="space-y-3">
								<p className="leading-relaxed">
									<strong>PostHog EU</strong> collecte pour Bus Tracker les données suivantes à des fins d'analyse de la
									fréquentation et d'aide à la résolution des anomalies :
								</p>
								<ul className="list-disc ml-6 space-y-1 text-sm text-muted-foreground">
									<li>Données techniques anonymisées (navigateur, système d'exploitation, type de terminal)</li>
									<li>Pages visitées</li>
									<li>Géolocalisation approximative (précise à la ville près)</li>
									<li>Erreurs levées dans le cadre de l'exécution de l'application</li>
								</ul>
								<p className="text-sm italic text-muted-foreground pt-2">
									Vos droits (accès, suppression) peuvent être exercés par mail à{" "}
									<Link to="mailto:contact@bus-tracker.fr" className="font-medium underline decoration-primary/50">
										contact@bus-tracker.fr
									</Link>
									.
								</p>
							</div>
						</section>

						{/* Section 5: Responsabilité */}
						<section className="space-y-3">
							<h3 className="font-bold text-xl flex items-center gap-2">
								<span className="bg-primary text-primary-foreground rounded-full size-6 inline-flex items-center justify-center text-xs">
									5
								</span>{" "}
								Responsabilité & Fiabilité
							</h3>
							<div className="space-y-3">
								<p className="leading-relaxed">
									Bien que les données soient considérées comme fiables pour la majorité des réseaux, elles sont
									fournies <strong>à titre indicatif uniquement</strong>.
								</p>
								<p className="leading-relaxed">
									Bus Tracker ne peut en aucun cas servir de preuve "légale" ou officielle (notamment devant un
									employeur ou toute autre autorité). L'exactitude des positions et des horaires n'est pas garantie et
									dépend des flux de données fournis par les opérateurs.
								</p>
							</div>
						</section>
					</div>
				</div>
			</main>
		</>
	);
}
