import { useId } from "react";
import { useLocalStorage } from "usehooks-ts";

import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";

export function PreviewVehicleNumberSetting() {
	const id = useId();
	const [previewVehicleNumber, setPreviewVehicleNumber] = useLocalStorage("preview-vehicle-number", false);

	return (
		<div className="flex items-center justify-between gap-4">
			<div className="grid gap-0.5">
				<Label htmlFor={id} className="text-base cursor-pointer">
					Numéro de véhicule
				</Label>
				<p className="text-sm text-muted-foreground">
					Prévisualiser le numéro de véhicule lors du zoom sur un point de la carte.
				</p>
			</div>
			<Switch id={id} checked={previewVehicleNumber} onCheckedChange={setPreviewVehicleNumber} />
		</div>
	);
}
