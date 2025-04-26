import { useLocalStorage } from "usehooks-ts";

import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";

export function ShowDebugInfoSetting() {
	const [showDebugInfo, setShowDebugInfo] = useLocalStorage("show-debug-info", false);

	return (
		<div className="flex items-center space-x-2">
			<Switch id="show-debug-info" checked={showDebugInfo} onCheckedChange={setShowDebugInfo} />
			<Label htmlFor="show-debug-info">Voir les informations de débogage</Label>
		</div>
	);
}
