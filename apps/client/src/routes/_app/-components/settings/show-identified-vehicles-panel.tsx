import { useId } from "react";
import { useLocalStorage } from "usehooks-ts";

import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import * as m from "~/paraglide/messages";

export function ShowIdentifiedVehiclesPanelSetting() {
	const id = useId();
	const [showPanel, setShowPanel] = useLocalStorage("show-identified-vehicles-panel", false);

	return (
		<div className="flex items-center justify-between gap-4">
			<div className="grid gap-0.5">
				<Label className="text-base cursor-pointer" htmlFor={id}>
					{m.settings_show_identified_vehicles_panel_label()}
				</Label>
				<p className="text-sm text-muted-foreground">{m.settings_show_identified_vehicles_panel_description()}</p>
			</div>
			<Switch checked={showPanel} id={id} onCheckedChange={setShowPanel} />
		</div>
	);
}
