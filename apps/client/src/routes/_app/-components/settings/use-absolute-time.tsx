import { useId } from "react";
import { useLocalStorage } from "usehooks-ts";

import { Label } from "~/components/ui/label";
import { Tabs } from "~/components/ui/tabs";
import * as m from "~/paraglide/messages";
import { SettingTabsList, SettingTabsTrigger } from "~/routes/_app/-components/settings/setting-tabs";

export function DisplayAbsoluteTimeSetting() {
	const id = useId();
	const [displayAbsoluteTime, setDisplayAbsoluteTime] = useLocalStorage("display-absolute-time", false);

	return (
		<div>
			<Label className="block mb-1 text-base" htmlFor={id}>
				{m.settings_time_display_label()}
			</Label>
			<Tabs
				value={displayAbsoluteTime ? "absolute" : "relative"}
				onValueChange={(v) => setDisplayAbsoluteTime(v === "absolute")}
			>
				<SettingTabsList className="grid-cols-2" id={id}>
					<SettingTabsTrigger value="relative">{m.settings_time_display_relative()}</SettingTabsTrigger>
					<SettingTabsTrigger value="absolute">{m.settings_time_display_absolute()}</SettingTabsTrigger>
				</SettingTabsList>
			</Tabs>
		</div>
	);
}
