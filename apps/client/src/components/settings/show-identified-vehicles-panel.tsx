import { useId } from "react";
import { useLocalStorage } from "usehooks-ts";

import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";

export function ShowIdentifiedVehiclesPanelSetting() {
	const id = useId();
	const [showPanel, setShowPanel] = useLocalStorage("show-identified-vehicles-panel", false);

	return (
		<div className="flex items-center justify-between gap-4">
			<div className="grid gap-0.5">
				<Label className="text-base cursor-pointer" htmlFor={id}>
					Véhicules géolocalisés
				</Label>
				<p className="text-sm text-muted-foreground">
					Afficher les véhicules géolocalisés et leurs caractéristiques lors du filtre par ligne sur la carte.
				</p>
			</div>
			<Switch checked={showPanel} id={id} onCheckedChange={setShowPanel} />
		</div>
	);
}
