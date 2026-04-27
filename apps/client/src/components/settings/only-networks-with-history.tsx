import { useLocalStorage } from "usehooks-ts";

import { Label } from "~/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";

export function OnlyNetworksWithHistorySetting() {
	const [onlyNetworksWithHistory, setOnlyNetworksWithHistory] = useLocalStorage("only-networks-with-history", true);

	return (
		<div>
			<div className="grid gap-0.5 mb-1">
				<Label className="text-base">Réseaux à afficher</Label>
				<p className="text-sm text-muted-foreground">
					Liste des réseaux à afficher sur la page de sélection de la page Données.
				</p>
			</div>
			<Tabs
				value={onlyNetworksWithHistory ? "history" : "all"}
				onValueChange={(v) => setOnlyNetworksWithHistory(v === "history")}
				className="w-full"
			>
				<TabsList className="grid w-full grid-cols-2">
					<TabsTrigger value="all">Tous les réseaux</TabsTrigger>
					<TabsTrigger value="history">Avec historique</TabsTrigger>
				</TabsList>
			</Tabs>
		</div>
	);
}
