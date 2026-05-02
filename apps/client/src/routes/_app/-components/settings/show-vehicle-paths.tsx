import { useId } from "react";
import { useLocalStorage } from "usehooks-ts";

import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import * as m from "~/paraglide/messages";

export function ShowVehiclePathsSetting() {
	const id = useId();
	const [showVehiclePaths, setShowVehiclePaths] = useLocalStorage("show-vehicle-paths", true);

	return (
		<div className="flex items-center justify-between gap-4">
			<div className="grid gap-0.5">
				<Label htmlFor={id} className="text-base cursor-pointer">
					{m.settings_show_vehicle_paths_label()}
				</Label>
				<p className="text-sm text-muted-foreground">{m.settings_show_vehicle_paths_description()}</p>
			</div>
			<Switch id={id} checked={showVehiclePaths} onCheckedChange={setShowVehiclePaths} />
		</div>
	);
}
