import { useId } from "react";
import { useLocalStorage } from "usehooks-ts";

import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";

export function GeolocateOnStartSetting() {
	const id = useId();
	const [geolocateOnStart, setGeolocateOnStart] = useLocalStorage("geolocate-on-start", false);

	return (
		<div className="flex items-center justify-between gap-4">
			<div className="grid gap-0.5">
				<Label htmlFor={id} className="text-base cursor-pointer">
					Géolocalisation automatique
				</Label>
				<p className="text-sm text-muted-foreground">Me localiser à l'ouverture de l'application.</p>
			</div>
			<Switch id={id} checked={geolocateOnStart} onCheckedChange={setGeolocateOnStart} />
		</div>
	);
}
