import { useId } from "react";
import { useLocalStorage } from "usehooks-ts";

import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import * as m from "~/paraglide/messages";

export function DisplayNextCallsSetting() {
	const id = useId();
	const [displayNextCalls, setDisplayNextCalls] = useLocalStorage("display-next-calls", true);

	return (
		<div className="flex items-center justify-between gap-4">
			<div className="grid gap-0.5">
				<Label htmlFor={id} className="text-base cursor-pointer">
					{m.settings_display_next_calls_label()}
				</Label>
				<p className="text-sm text-muted-foreground">{m.settings_display_next_calls_description()}</p>
			</div>
			<Switch id={id} checked={displayNextCalls} onCheckedChange={setDisplayNextCalls} />
		</div>
	);
}
