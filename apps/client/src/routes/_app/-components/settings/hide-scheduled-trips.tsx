import { useQueryClient } from "@tanstack/react-query";
import { useId } from "react";
import { useLocalStorage } from "usehooks-ts";

import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import * as m from "~/paraglide/messages";

export function HideScheduledTripsSetting() {
	const id = useId();
	const queryClient = useQueryClient();
	const [hideScheduledTrips, setHideScheduledTrips] = useLocalStorage("hide-scheduled-trips", false);

	const onChange = (checked: boolean) => {
		setHideScheduledTrips(checked);
		queryClient.refetchQueries({ queryKey: ["vehicle-journeys"] });
	};

	return (
		<div className="flex items-center justify-between gap-4">
			<div className="grid gap-0.5">
				<Label htmlFor={id} className="text-base cursor-pointer">
					{m.settings_hide_scheduled_trips_label()}
				</Label>
				<p className="text-sm text-muted-foreground">{m.settings_hide_scheduled_trips_description()}</p>
			</div>
			<Switch id={id} checked={hideScheduledTrips} onCheckedChange={onChange} />
		</div>
	);
}
