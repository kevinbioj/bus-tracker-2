import { useLocalStorage } from "usehooks-ts";

import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";

export function GeolocateOnStartSetting() {
	const [geolocateOnStart, setGeolocateOnStart] = useLocalStorage("geolocate-on-start", false);

	return (
		<div className="flex items-center space-x-2">
			<Switch id="geolocate-on-start" checked={geolocateOnStart} onCheckedChange={setGeolocateOnStart} />
			<Label htmlFor="geolocate-on-start">Me géolocaliser à l'ouverture</Label>
		</div>
	);
}
