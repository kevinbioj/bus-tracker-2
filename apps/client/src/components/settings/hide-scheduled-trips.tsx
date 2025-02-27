import { useLocalStorage } from "usehooks-ts";

import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";

export function HideScheduledTripsSetting() {
	const [hideScheduledTrips, setHideScheduledTrips] = useLocalStorage("hide-scheduled-trips", false);

	return (
		<div className="flex items-center space-x-2">
			<Switch id="hide-scheduled-trips" checked={hideScheduledTrips} onCheckedChange={setHideScheduledTrips} />
			<Label htmlFor="hide-scheduled-trips">Masquer les courses théoriques</Label>
		</div>
	);
}
