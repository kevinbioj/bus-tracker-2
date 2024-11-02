"use client";

import { useLocalStorage } from "usehooks-ts";

import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";

export default function NextStopsPreference() {
	const [showNextStops, setShowNextStops] = useLocalStorage("show-next-stops", true);
	return (
		<div className="flex gap-3 items-center">
			<Switch checked={showNextStops} id="next-stops-preference" onCheckedChange={setShowNextStops} />
			<Label htmlFor="next-stops-preference">Afficher les prochains passages (si disponible)</Label>
		</div>
	);
}
