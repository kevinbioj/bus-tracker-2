import { MoonIcon, SunIcon, SunMoonIcon } from "lucide-react";
import { useId } from "react";

import { Label } from "~/components/ui/label";
import { Tabs } from "~/components/ui/tabs";
import { type MapThemeSetting as MapThemeSettingValue, useMapThemeSetting } from "~/components/vehicles-map/map-style";
import * as m from "~/paraglide/messages";
import { SettingTabsList, SettingTabsTrigger } from "~/routes/_app/-components/settings/setting-tabs";

const options = [
	{ value: "auto", icon: SunMoonIcon, label: m.settings_map_theme_auto },
	{ value: "light", icon: SunIcon, label: m.settings_map_theme_light },
	{ value: "dark", icon: MoonIcon, label: m.settings_map_theme_dark },
] as const satisfies { value: MapThemeSettingValue; icon: unknown; label: () => string }[];

export function MapThemeSetting() {
	const id = useId();
	const [mapTheme, setMapTheme] = useMapThemeSetting();

	return (
		<div>
			<Label className="block mb-1 text-base" htmlFor={id}>
				{m.settings_map_theme_label()}
			</Label>
			<Tabs value={mapTheme} onValueChange={(value) => setMapTheme(value as MapThemeSettingValue)} className="w-full">
				<SettingTabsList className="grid-cols-3" id={id}>
					{options.map(({ value, icon: Icon, label }) => (
						<SettingTabsTrigger key={value} value={value}>
							<Icon />
							{label()}
						</SettingTabsTrigger>
					))}
				</SettingTabsList>
			</Tabs>
		</div>
	);
}
