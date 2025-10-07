import { useQueryClient } from "@tanstack/react-query";
import { useId } from "react";
import { useLocalStorage } from "usehooks-ts";

import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";

export function HideScheduledTripsSetting() {
	const id = useId();
	const queryClient = useQueryClient();
	const [hideScheduledTrips, setHideScheduledTrips] = useLocalStorage("hide-scheduled-trips", false);

	const onChange = (checked: boolean) => {
		setHideScheduledTrips(checked);
		queryClient.refetchQueries({ queryKey: ["vehicle-journeys"] });
	};

	return (
		<div className="flex items-center space-x-2">
			<Switch id={id} checked={hideScheduledTrips} onCheckedChange={onChange} />
			<Label htmlFor={id}>Masquer les courses théoriques</Label>
		</div>
	);
}
