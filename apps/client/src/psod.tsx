import { FrownIcon } from "lucide-react";
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
		<main className="bg-branding flex flex-col items-center justify-center gap-10 h-dvh text-branding-foreground">
			<div className="flex items-center gap-3 h-10 my-2">
				<img className="h-full" src="/logo.svg" alt="" />
				<span className="text-center font-bold text-3xl text-white select-none hover:cursor-default">Bus Tracker</span>
			</div>
			<div className="flex-1">
				<div className="flex flex-col gap-3">
					<FrownIcon className="mx-auto size-32" />
					<h1 className="font-bold text-2xl text-center">Oh oh...</h1>
				</div>
				<div className="flex flex-col gap-8 text-center text-sm">
					<div className="flex flex-col items-center gap-1">
						<p>
							Il semblerait que quelque chose se soit mal passé !<br />
							Relancer l'application devrait régler le problème 👍
						</p>
						<Button asChild variant="on-branding-default">
							<a href={embeddedNetworkId ? `/embed/${embeddedNetworkId}` : "/"}>Relancer l'application</a>
						</Button>
					</div>
					<div className="flex flex-col items-center gap-1">
						<p>Si votre problème persiste, vous pouvez tenter de réinitialiser vos réglages.</p>
						<Button onClick={resetApp} variant="on-branding-default">
							Réinitialiser l'app
						</Button>
					</div>
					<p>
						Les données relatives à cet événement ont été remontées pour analyse.
						<br />
						Si cela perdure dans le temps, contactez-nous à l'adresse{" "}
						<Link to="mailto:contact@bus-tracker.fr">contact@bus-tracker.fr</Link>.
					</p>
				</div>
			</div>
		</main>
	);
}
