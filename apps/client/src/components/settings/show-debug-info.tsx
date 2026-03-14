import { useId } from "react";
import { useLocalStorage } from "usehooks-ts";

import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";

export function ShowDebugInfoSetting() {
	const id = useId();
	const [showDebugInfo, setShowDebugInfo] = useLocalStorage("show-debug-info", false);

	return (
		<div className="flex items-center justify-between gap-4">
			<div className="grid gap-0.5">
				<Label htmlFor={id} className="text-base cursor-pointer">
					Mode débogage
				</Label>
				<p className="text-sm text-muted-foreground">Voir les informations techniques de l'application.</p>
			</div>
			<Switch id={id} checked={showDebugInfo} onCheckedChange={setShowDebugInfo} />
		</div>
	);
}
