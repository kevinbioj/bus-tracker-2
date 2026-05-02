import { useId } from "react";
import { useLocalStorage } from "usehooks-ts";

import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import * as m from "~/paraglide/messages";

export function GeolocateOnStartSetting() {
	const id = useId();
	const [geolocateOnStart, setGeolocateOnStart] = useLocalStorage("geolocate-on-start", false);

	return (
		<div className="flex items-center justify-between gap-4">
			<div className="grid gap-0.5">
				<Label htmlFor={id} className="text-base cursor-pointer">
					{m.settings_geolocate_on_start_label()}
				</Label>
				<p className="text-sm text-muted-foreground">{m.settings_geolocate_on_start_description()}</p>
			</div>
			<Switch id={id} checked={geolocateOnStart} onCheckedChange={setGeolocateOnStart} />
		</div>
	);
}
