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
		<div className="flex items-center justify-between gap-4">
			<div className="grid gap-0.5">
				<Label htmlFor={id} className="text-base cursor-pointer">
					Masquer les courses théoriques
				</Label>
				<p className="text-sm text-muted-foreground">
					Masquer les courses pour lesquelles aucun temps réel n'est disponible.
				</p>
			</div>
			<Switch id={id} checked={hideScheduledTrips} onCheckedChange={onChange} />
		</div>
	);
}
