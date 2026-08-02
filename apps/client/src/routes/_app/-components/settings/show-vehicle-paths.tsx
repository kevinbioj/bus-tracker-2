import { useId } from "react";

import { Label } from "~/components/ui/label";
import { Tabs } from "~/components/ui/tabs";
import { usePathDisplayMode } from "~/components/vehicles-map/path-display-mode";
import * as m from "~/paraglide/messages";
import { SettingTabsList, SettingTabsTrigger } from "~/routes/_app/-components/settings/setting-tabs";

export function ShowVehiclePathsSetting() {
	const id = useId();
	const [pathDisplayMode, setPathDisplayMode] = usePathDisplayMode();

	return (
		<div>
			<Label htmlFor={id} className="block mb-1 text-base">
				{m.settings_show_vehicle_paths_label()}
			</Label>
			<Tabs value={pathDisplayMode} onValueChange={(value) => setPathDisplayMode(value as typeof pathDisplayMode)}>
				<SettingTabsList className="grid-cols-3" id={id}>
					<SettingTabsTrigger value="disabled">{m.settings_show_vehicle_paths_disabled()}</SettingTabsTrigger>
					<SettingTabsTrigger value="journeys">{m.settings_show_vehicle_paths_journeys()}</SettingTabsTrigger>
					<SettingTabsTrigger value="journeys-and-lines">
						{m.settings_show_vehicle_paths_journeys_and_lines()}
					</SettingTabsTrigger>
				</SettingTabsList>
			</Tabs>
		</div>
	);
}
