import { useId } from "react";

import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { useShowStops } from "~/components/vehicles-map/show-stops";
import * as m from "~/paraglide/messages";

export function ShowStopsSetting() {
	const id = useId();
	const [showStops, setShowStops] = useShowStops();

	return (
		<div className="flex items-center justify-between gap-4">
			<div className="grid gap-px">
				<Label htmlFor={id} className="text-base cursor-pointer">
					{m.settings_show_stops_label()}
				</Label>
				<p className="text-sm text-muted-foreground">{m.settings_show_stops_description()}</p>
			</div>
			<Switch id={id} checked={showStops} onCheckedChange={setShowStops} />
		</div>
	);
}
