import { useId } from "react";
import { useLocalStorage } from "usehooks-ts";

import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import * as m from "~/paraglide/messages";

export function PreviewVehicleNumberSetting() {
	const id = useId();
	const [previewVehicleNumber, setPreviewVehicleNumber] = useLocalStorage("preview-vehicle-number", false);

	return (
		<div className="flex items-center justify-between gap-4">
			<div className="grid gap-0.5">
				<Label htmlFor={id} className="text-base cursor-pointer">
					{m.settings_preview_vehicle_number_label()}
				</Label>
				<p className="text-sm text-muted-foreground">{m.settings_preview_vehicle_number_description()}</p>
			</div>
			<Switch id={id} checked={previewVehicleNumber} onCheckedChange={setPreviewVehicleNumber} />
		</div>
	);
}
