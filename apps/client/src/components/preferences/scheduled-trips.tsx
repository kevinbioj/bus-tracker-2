"use client";

import { useLocalStorage } from "usehooks-ts";

import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";

export default function ScheduledTripsPreference() {
	const [showScheduledTrips, setShowScheduledTrips] = useLocalStorage("show-scheduled-trips", true);
	return (
		<div className="flex gap-3 items-center">
			<Switch checked={showScheduledTrips} id="scheduled-trips-preference" onCheckedChange={setShowScheduledTrips} />
			<Label htmlFor="scheduled-trips-preference">Afficher les courses théoriques</Label>
		</div>
	);
}
