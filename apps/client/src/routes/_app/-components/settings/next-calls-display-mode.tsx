import { Tabs } from "~/components/ui/tabs";
import { type NextCallsDisplayMode, useNextCallsDisplayMode } from "~/components/vehicles-map/next-calls-display-mode";
import * as m from "~/paraglide/messages";
import { SettingTabsList, SettingTabsTrigger } from "~/routes/_app/-components/settings/setting-tabs";

export function NextCallsDisplayModeSetting() {
	const [nextCallsDisplayMode, setNextCallsDisplayMode] = useNextCallsDisplayMode();

	return (
		<Tabs
			value={nextCallsDisplayMode}
			onValueChange={(value) => setNextCallsDisplayMode(value as NextCallsDisplayMode)}
		>
			<SettingTabsList aria-label={m.settings_next_calls_display_label()} className="grid-cols-2">
				<SettingTabsTrigger value="relative">{m.settings_next_calls_display_relative()}</SettingTabsTrigger>
				<SettingTabsTrigger value="absolute">{m.settings_next_calls_display_absolute()}</SettingTabsTrigger>
			</SettingTabsList>
		</Tabs>
	);
}
