import { useId } from "react";
import { useLocalStorage } from "usehooks-ts";

import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";

export function ShowVehiclePathsSetting() {
	const id = useId();
	const [showVehiclePaths, setShowVehiclePaths] = useLocalStorage("show-vehicle-paths", false);

	return (
		<div className="flex items-center justify-between gap-4">
			<div className="grid gap-0.5">
				<Label htmlFor={id} className="text-base cursor-pointer">
					Tracés des courses
				</Label>
				<p className="text-sm text-muted-foreground">
					Afficher le tracé théorique de la course lors de la sélection d'un véhicule (indisponible sur certains
					réseaux).
				</p>
			</div>
			<Switch id={id} checked={showVehiclePaths} onCheckedChange={setShowVehiclePaths} />
		</div>
	);
}
