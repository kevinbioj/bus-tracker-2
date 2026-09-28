import { useId } from "react";

import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { useShowWheelchairAccessibility } from "~/components/vehicles-map/accessibility-display";
import * as m from "~/paraglide/messages";

export function ShowWheelchairAccessibilitySetting() {
	const id = useId();
	const [showWheelchairAccessibility, setShowWheelchairAccessibility] = useShowWheelchairAccessibility();

	return (
		<div className="flex items-center justify-between gap-4">
			<Label htmlFor={id} className="text-base cursor-pointer">
				{m.settings_show_wheelchair_accessibility_label()}
			</Label>
			<Switch id={id} checked={showWheelchairAccessibility} onCheckedChange={setShowWheelchairAccessibility} />
		</div>
	);
}
