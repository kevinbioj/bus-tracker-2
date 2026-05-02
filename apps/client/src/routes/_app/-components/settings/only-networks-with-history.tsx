import { useId } from "react";
import { useLocalStorage } from "usehooks-ts";

import { Label } from "~/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import * as m from "~/paraglide/messages";

export function OnlyNetworksWithHistorySetting() {
	const id = useId();
	const [onlyNetworksWithHistory, setOnlyNetworksWithHistory] = useLocalStorage("only-networks-with-history", true);

	return (
		<div>
			<div className="grid gap-0.5 mb-1">
				<Label className="text-base" htmlFor={id}>
					{m.settings_only_networks_with_history_label()}
				</Label>
				<p className="text-sm text-muted-foreground">{m.settings_only_networks_with_history_description()}</p>
			</div>
			<Tabs
				value={onlyNetworksWithHistory ? "history" : "all"}
				onValueChange={(v) => setOnlyNetworksWithHistory(v === "history")}
				className="w-full"
			>
				<TabsList className="grid w-full grid-cols-2" id={id}>
					<TabsTrigger value="all">{m.settings_only_networks_with_history_all()}</TabsTrigger>
					<TabsTrigger value="history">{m.settings_only_networks_with_history_history()}</TabsTrigger>
				</TabsList>
			</Tabs>
		</div>
	);
}
