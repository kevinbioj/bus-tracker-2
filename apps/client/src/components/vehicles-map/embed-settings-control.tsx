import { ListOrderedIcon } from "lucide-react";

import { useShowBikesAllowed, useShowWheelchairAccessibility } from "~/components/vehicles-map/accessibility-display";
import {
	NextCallsDisplayModeChoice,
	SettingSection,
	SettingsPopoverControl,
	SettingToggle,
	settingIconClasses,
} from "~/components/vehicles-map/settings-popover";
import { BikesAllowedIcon } from "~/icons/bikes-allowed";
import { WheelchairIcon } from "~/icons/wheelchair";
import * as m from "~/paraglide/messages";

/**
 * Réglages d'affichage de la carte embarquée, à portée de main sur la carte. Ils sont propres à la
 * carte (cf. `EmbedDisplaySettingsProvider`) : les préférences de l'application n'en sont pas changées.
 */
export function EmbedSettingsControl() {
	const [showWheelchairAccessibility, setShowWheelchairAccessibility] = useShowWheelchairAccessibility();
	const [showBikesAllowed, setShowBikesAllowed] = useShowBikesAllowed();

	return (
		<SettingsPopoverControl>
			<SettingSection title={m.settings_vehicle_card_section()}>
				<NextCallsDisplayModeChoice icon={<ListOrderedIcon className={settingIconClasses} />} />
			</SettingSection>
			<SettingSection title={m.settings_accessibility_section()}>
				<SettingToggle
					checked={showWheelchairAccessibility}
					icon={<WheelchairIcon className="size-5 shrink-0" status="accessible" />}
					label={m.settings_show_wheelchair_accessibility_label()}
					onCheckedChange={setShowWheelchairAccessibility}
				/>
				<SettingToggle
					checked={showBikesAllowed}
					icon={<BikesAllowedIcon className="size-5 shrink-0" status="allowed" />}
					label={m.settings_show_bikes_allowed_label()}
					onCheckedChange={setShowBikesAllowed}
				/>
			</SettingSection>
		</SettingsPopoverControl>
	);
}
