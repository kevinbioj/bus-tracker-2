import { useId } from "react";

import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { useShowBikesAllowed } from "~/components/vehicles-map/accessibility-display";
import * as m from "~/paraglide/messages";

export function ShowBikesAllowedSetting() {
	const id = useId();
	const [showBikesAllowed, setShowBikesAllowed] = useShowBikesAllowed();

	return (
		<div className="flex items-center justify-between gap-4">
			<Label htmlFor={id} className="text-base cursor-pointer">
				{m.settings_show_bikes_allowed_label()}
			</Label>
			<Switch id={id} checked={showBikesAllowed} onCheckedChange={setShowBikesAllowed} />
		</div>
	);
}
