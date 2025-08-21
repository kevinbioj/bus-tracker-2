import { useId } from "react";
import { useLocalStorage } from "usehooks-ts";

import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";

export function DisplayNextCallsSetting() {
	const id = useId();
	const [displayNextCalls, setDisplayNextCalls] = useLocalStorage("display-next-calls", true);

	return (
		<div className="flex items-center space-x-2">
			<Switch id={id} checked={displayNextCalls} onCheckedChange={setDisplayNextCalls} />
			<Label htmlFor={id}>Afficher les prochains passages (si disponibles)</Label>
		</div>
	);
}
