import { AlertTriangleIcon } from "lucide-react";
import { useId } from "react";
import { useLocalStorage } from "usehooks-ts";

import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import * as m from "~/paraglide/messages";

export function BypassMinZoomSetting() {
	const id = useId();
	const [bypassMinZoom, setBypassMinZoom] = useLocalStorage("bypass-min-zoom", false);

	return (
		<div className="flex items-center justify-between gap-4">
			<div className="grid gap-0.5">
				<Label htmlFor={id} className="text-base cursor-pointer">
					{m.settings_bypass_min_zoom_label()}
				</Label>
				<p className="text-sm text-muted-foreground">
					<AlertTriangleIcon className="inline size-4 text-amber-500" /> {m.settings_bypass_min_zoom_description()}
				</p>
			</div>
			<Switch id={id} checked={bypassMinZoom} onCheckedChange={setBypassMinZoom} />
		</div>
	);
}
