import { useLocalStorage } from "usehooks-ts";

import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";

export function DisplayNextCallsSetting() {
	const [displayNextCalls, setDisplayNextCalls] = useLocalStorage("display-next-calls", true);

	return (
		<div className="flex items-center space-x-2">
			<Switch id="display-next-calls" checked={displayNextCalls} onCheckedChange={setDisplayNextCalls} />
			<Label htmlFor="display-next-calls">Afficher les prochains passages (si disponibles)</Label>
		</div>
	);
}
