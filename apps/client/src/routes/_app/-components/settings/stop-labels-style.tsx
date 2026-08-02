import { useId } from "react";
import { useLocalStorage } from "usehooks-ts";

import { Label } from "~/components/ui/label";
import { Tabs } from "~/components/ui/tabs";
import { usePathDisplayMode } from "~/components/vehicles-map/path-display-mode";
import type { StopLabelsStyle } from "~/components/vehicles-map/stop-labels-style";
import * as m from "~/paraglide/messages";
import { SettingTabsList, SettingTabsTrigger } from "~/routes/_app/-components/settings/setting-tabs";

export function StopLabelsStyleSetting() {
	const id = useId();
	const [pathDisplayMode] = usePathDisplayMode();
	const [stopLabelsStyle, setStopLabelsStyle] = useLocalStorage<StopLabelsStyle>(
		"stop-labels-style",
		"with-background",
	);

	if (pathDisplayMode === "disabled") {
		return null;
	}

	return (
		<div>
			<Label className="block mb-1 text-base" htmlFor={id}>
				{m.settings_stop_labels_style_label()}
			</Label>
			<Tabs
				value={stopLabelsStyle}
				onValueChange={(value) => setStopLabelsStyle(value as StopLabelsStyle)}
				className="w-full"
			>
				<SettingTabsList className="grid-cols-3" id={id}>
					<SettingTabsTrigger value="disabled">{m.settings_stop_labels_style_disabled()}</SettingTabsTrigger>
					<SettingTabsTrigger value="without-background">
						{m.settings_stop_labels_style_without_background()}
					</SettingTabsTrigger>
					<SettingTabsTrigger value="with-background">
						{m.settings_stop_labels_style_with_background()}
					</SettingTabsTrigger>
				</SettingTabsList>
			</Tabs>
		</div>
	);
}
