import { useSearchParams } from "react-router-dom";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "~/components/ui/dialog";

export function WelcomeBack() {
	const [searchParams, setSearchParams] = useSearchParams();

	const wasRedirected = searchParams.get("from_old") === "true";

	return (
		<Dialog open={wasRedirected} onOpenChange={() => setSearchParams({})}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Bienvenue sur la nouvelle version</DialogTitle>
					<DialogDescription>
						Cette adresse (<a href="https://bus-tracker.fr">bus-tracker.fr</a>) remplace désormais l'instance locale que
						vous aviez l'habitude d'utiliser.
						<br />
						<br />
						L'ensemble des fonctionnalités ont été reprises sur cette nouvelle version.
						<br />
						Pensez néanmoins à prendre quelques minutes de votre temps afin de prendre vos repères 😉<br />
						<br />
						Concernant les données, celles-ci ont été synchronisées afin qu'aucune information ne soit perdue.
						<br />
						<br />
						Pour toute interrogation autre, contactez-moi par e-mail
					</DialogDescription>
				</DialogHeader>
			</DialogContent>
		</Dialog>
	);
}
