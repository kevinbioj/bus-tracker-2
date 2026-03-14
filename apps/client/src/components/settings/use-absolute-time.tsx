import { useLocalStorage } from "usehooks-ts";

import { Label } from "~/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";

export function DisplayAbsoluteTimeSetting() {
	const [displayAbsoluteTime, setDisplayAbsoluteTime] = useLocalStorage("display-absolute-time", false);

	return (
		<div>
			<Label className="block mb-1 text-base">Affichage de l'heure</Label>
			<Tabs
				value={displayAbsoluteTime ? "absolute" : "relative"}
				onValueChange={(v) => setDisplayAbsoluteTime(v === "absolute")}
			>
				<TabsList className="grid grid-cols-2">
					<TabsTrigger value="relative">Heure relative</TabsTrigger>
					<TabsTrigger value="absolute">Heure absolue</TabsTrigger>
				</TabsList>
			</Tabs>
		</div>
	);
}
