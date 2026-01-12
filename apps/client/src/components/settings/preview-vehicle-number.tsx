import { useId } from "react";
import { useLocalStorage } from "usehooks-ts";

import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";

export function PreviewVehicleNumberSetting() {
	const id = useId();
	const [previewVehicleNumber, setPreviewVehicleNumber] = useLocalStorage("preview-vehicle-number", false);

	return (
		<div className="flex items-center space-x-2">
			<Switch id={id} checked={previewVehicleNumber} onCheckedChange={setPreviewVehicleNumber} />
			<Label htmlFor={id}>Prévisualiser le numéro du véhicule (si disponible)</Label>
		</div>
	);
}
