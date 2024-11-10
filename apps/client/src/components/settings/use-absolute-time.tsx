import { useLocalStorage } from "usehooks-ts";

import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";

export function DisplayAbsoluteTimeSetting() {
	const [displayAbsoluteTime, setDisplayAbsoluteTime] = useLocalStorage("display-absolute-time", false);

	return (
		<div className="flex items-center space-x-2">
			<Switch id="display-absolute-time" checked={displayAbsoluteTime} onCheckedChange={setDisplayAbsoluteTime} />
			<Label htmlFor="display-absolute-time">Afficher l'heure absolue à la place de l'heure relative</Label>
		</div>
	);
}
