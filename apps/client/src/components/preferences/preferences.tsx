"use client";

import { Settings as SettingsIcon } from "tabler-icons-react";

import GeolocationPreference from "~/components/preferences/geolocation";
import NextStopsPreference from "~/components/preferences/next-stops";
import ScheduledTripsPreference from "~/components/preferences/scheduled-trips";
import UseAbsoluteTimePreference from "~/components/preferences/use-absolute-time";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";

export default function Preferences() {
	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button aria-label="Ouvrir les préférences" variant="inherit">
					<SettingsIcon size={32} />
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Paramètres de la carte</DialogTitle>
				</DialogHeader>
				<div className="flex flex-col gap-4">
					<GeolocationPreference />
					<ScheduledTripsPreference />
					<NextStopsPreference />
					<UseAbsoluteTimePreference />
				</div>
				<hr className="my-2" />
				<DialogTitle>Besoin de me contacter ?</DialogTitle>
				<p>
					Un bug ? Une suggestion ? Une remarque ou une question ?<br />
					Envoyez-moi un e-mail à{" "}
					<a
						className="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
						href="mailto:contact@bus-tracker.fr?subject=Bus Tracker - ?"
					>
						contact@bus-tracker.fr
					</a>{" "}
					😉
				</p>
			</DialogContent>
		</Dialog>
	);
}
