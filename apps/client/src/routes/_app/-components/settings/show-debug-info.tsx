import { useId } from "react";
import { useLocalStorage } from "usehooks-ts";

import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import * as m from "~/paraglide/messages";

export function ShowDebugInfoSetting() {
	const id = useId();
	const [showDebugInfo, setShowDebugInfo] = useLocalStorage("show-debug-info", false);

	return (
		<div className="flex items-center justify-between">
			<div className="grid gap-0.5">
				<Label htmlFor={id} className="text-base cursor-pointer">
					{m.settings_show_debug_info_label()}
				</Label>
				<p className="text-sm text-muted-foreground">{m.settings_show_debug_info_description()}</p>
			</div>
			<Switch id={id} checked={showDebugInfo} onCheckedChange={setShowDebugInfo} />
		</div>
	);
}
