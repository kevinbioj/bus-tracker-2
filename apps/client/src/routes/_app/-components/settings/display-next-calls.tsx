import { useId } from "react";
import { useLocalStorage } from "usehooks-ts";

import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";

export function DisplayNextCallsSetting() {
	const id = useId();
	const [displayNextCalls, setDisplayNextCalls] = useLocalStorage("display-next-calls", true);

	return (
		<div className="flex items-center justify-between gap-4">
			<div className="grid gap-0.5">
				<Label htmlFor={id} className="text-base cursor-pointer">
					Prochains passages
				</Label>
				<p className="text-sm text-muted-foreground">Afficher les arrêts suivants (si disponibles).</p>
			</div>
			<Switch id={id} checked={displayNextCalls} onCheckedChange={setDisplayNextCalls} />
		</div>
	);
}
