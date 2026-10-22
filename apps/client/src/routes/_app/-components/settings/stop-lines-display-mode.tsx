import { Tabs } from "~/components/ui/tabs";
import { useShowStops } from "~/components/vehicles-map/show-stops";
import { type StopLinesDisplayMode, useStopLinesDisplayMode } from "~/components/vehicles-map/stop-lines-display-mode";
import * as m from "~/paraglide/messages";
import { SettingTabsList, SettingTabsTrigger } from "~/routes/_app/-components/settings/setting-tabs";

export function StopLinesDisplayModeSetting() {
	const [showStops] = useShowStops();
	const [stopLinesDisplayMode, setStopLinesDisplayMode] = useStopLinesDisplayMode();

	if (!showStops) {
		return null;
	}

	return (
		<Tabs
			value={stopLinesDisplayMode}
			onValueChange={(value) => setStopLinesDisplayMode(value as StopLinesDisplayMode)}
		>
			<SettingTabsList aria-label={m.settings_stop_lines_display_label()} className="grid-cols-2">
				<SettingTabsTrigger value="without">{m.settings_stop_lines_display_without()}</SettingTabsTrigger>
				<SettingTabsTrigger value="with">{m.settings_stop_lines_display_with()}</SettingTabsTrigger>
			</SettingTabsList>
		</Tabs>
	);
}
