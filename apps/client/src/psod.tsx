import { Copy, FrownIcon } from "lucide-react";
import { usePostHog } from "posthog-js/react";
import { useEffect } from "react";
import { useLocation, useRouteError } from "react-router-dom";

import { Button } from "~/components/ui/button";
import { Link } from "~/components/ui/link";

export function PurpleScreenOfDeath() {
	const { pathname } = useLocation();
	const embeddedNetworkId = pathname.startsWith("/embed/") ? pathname.split("/")[2] : undefined;

	const posthog = usePostHog();
	const error = useRouteError();

	useEffect(() => {
		if (error) {
			console.error(error);
			posthog.captureException(error);
		}
	}, [error, posthog]);

	const resetApp = () => {
		localStorage.clear();
		location.href = embeddedNetworkId ? `/embed/${embeddedNetworkId}` : "/";
	};

	return (
		<div className="bg-branding text-branding-foreground h-dvh">
			<header className="h-16 p-3 flex justify-center items-center gap-3">
				<img className="h-full" src="/logo.svg" alt="" />
				<span className="text-center font-bold text-3xl select-none hover:cursor-default">Bus Tracker</span>
			</header>
			<main className="px-3 mt-10 text-base">
				<div className="max-w-3xl mx-auto">
					<div className="flex items-center gap-2">
						<FrownIcon className="size-12" />
						<h1 className="font-bold text-3xl">Une erreur est survenue</h1>
					</div>
					<div className="flex flex-col items-start gap-2 mt-3">
						<p>
							Les informations relatives à l'erreur ont été remontées pour analyse.
							<br />
							En attendant, vous pouvez essayer de recharger l'application.
						</p>
						<Button asChild className="hover:cursor-default" variant="on-branding-default">
							<a href={embeddedNetworkId ? `/embed/${embeddedNetworkId}` : "/"}>Recharger l'application</a>
						</Button>
					</div>
					<div className="flex flex-col items-start gap-2 mt-8">
						<p>Si le problème persiste, vous pouvez également essayer de réinitialiser les données de l'application.</p>
						<Button onClick={resetApp} variant="on-branding-default">
							Réinitialiser l'app
						</Button>
					</div>
					<div className="flex flex-col items-start gap-2 mt-8">
						<p>
							Enfin, vous pouvez nous contacter à l'adresse{" "}
							<Link
								className="text-branding-foreground/70 hover:text-branding-foreground/50"
								to="mailto:contact@bus-tracker.fr"
							>
								contact@bus-tracker.fr
							</Link>{" "}
							avec le rapport d'erreur ci-dessous.
						</p>
						<div className="border border-neutral-600 rounded-lg bg-neutral-800 p-3 w-full wrap-break-word">
							<div className="flex justify-between">
								<span>Rapport d'erreur</span>
								<Button onClick={() => navigator.clipboard.writeText(String(error))} size="sm" variant="ghost">
									<Copy className="size-4" /> Copier
								</Button>
							</div>
							<div className="font-mono text-neutral-300 mt-0.5">{String(error)}</div>
						</div>
					</div>
				</div>
			</main>
		</div>
	);
}
