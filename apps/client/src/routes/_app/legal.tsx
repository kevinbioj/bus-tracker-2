import { createFileRoute } from "@tanstack/react-router";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Link } from "~/components/ui/link";
import { Separator } from "~/components/ui/separator";
import * as m from "~/paraglide/messages";

export const Route = createFileRoute("/_app/legal")({
	component: LegalPage,
});

function LegalPage() {
	return (
		<>
			<title>{m.legal_page_title()}</title>
			<main className="p-3 max-w-(--breakpoint-xl) w-full mx-auto space-y-4">
				<div className="flex flex-col gap-2">
					<h2 className="font-bold text-2xl">{m.legal_title()}</h2>
					<p className="text-muted-foreground text-sm uppercase tracking-widest">{m.legal_updated_at()}</p>
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
								{m.legal_editor_title()}
							</h3>
							<div className="space-y-3">
								<p className="leading-relaxed">
									{m.legal_editor_text()}
								</p>
								<Card className="bg-muted/50 border-none shadow-none">
									<CardContent className="p-4 pt-4 italic text-sm text-muted-foreground leading-relaxed">
										{m.legal_editor_anonymous()}
									</CardContent>
								</Card>
								<p className="flex items-center gap-2">
									<span className="font-semibold">{m.legal_contact()}</span>
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
								{m.legal_hosting_title()}
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
											<span className="font-medium text-muted-foreground">{m.legal_email()}</span> contact[at]yorkhost.fr
										</p>
										<p>
											<span className="font-medium text-muted-foreground">{m.legal_site()}</span>{" "}
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
								{m.legal_ip_title()}
							</h3>
							<div className="space-y-4">
								<div className="space-y-2">
									<p className="text-sm leading-relaxed">
										{m.legal_source_license()}{" "}
										<Link className="underline" to="https://github.com/kevinbioj/bus-tracker-2" target="_blank">
											GitHub
										</Link>
										.
									</p>
								</div>
								<Card className="bg-amber-500/10 border-amber-500/20 shadow-none">
									<CardContent className="p-4 pt-4 space-y-2">
										<h4 className="font-semibold text-amber-900 dark:text-amber-200">{m.legal_content_identity_title()}</h4>
										<p className="text-amber-800 dark:text-amber-300 text-sm leading-relaxed">
											{m.legal_content_identity_text()}
											<br />
											<strong className="underline decoration-amber-500/50">
												{m.legal_content_identity_warning()}
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
								{m.legal_privacy_title()}
							</h3>
							<div className="space-y-3">
								<p className="leading-relaxed">
									{m.legal_privacy_intro()}
								</p>
								<ul className="list-disc ml-6 space-y-1 text-sm text-muted-foreground">
									<li>{m.legal_privacy_technical_data()}</li>
									<li>{m.legal_privacy_pages()}</li>
									<li>{m.legal_privacy_location()}</li>
									<li>{m.legal_privacy_errors()}</li>
								</ul>
								<p className="text-sm italic text-muted-foreground pt-2">
									{m.legal_privacy_rights()}{" "}
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
								{m.legal_reliability_title()}
							</h3>
							<div className="space-y-3">
								<p className="leading-relaxed">
									{m.legal_reliability_indicative()}
								</p>
								<p className="leading-relaxed">
									{m.legal_reliability_proof()}
								</p>
							</div>
						</section>
					</div>
				</div>
			</main>
		</>
	);
}
