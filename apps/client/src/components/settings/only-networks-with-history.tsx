import { useId } from "react";
import { useLocalStorage } from "usehooks-ts";

import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";

export function OnlyNetworksWithHistorySetting() {
	const id = useId();
	const [onlyNetworksWithHistory, setOnlyNetworksWithHistory] = useLocalStorage("only-networks-with-history", true);

	return (
		<div className="flex items-center space-x-2">
			<Switch id={id} checked={onlyNetworksWithHistory} onCheckedChange={setOnlyNetworksWithHistory} />
			<Label htmlFor={id}>N'afficher que les réseaux avec historique</Label>
		</div>
	);
}
