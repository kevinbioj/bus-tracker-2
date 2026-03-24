import { useLocalStorage } from "usehooks-ts";

import { Label } from "~/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";

export type StopLabelsStyle = "disabled" | "without-background" | "with-background";

export function StopLabelsStyleSetting() {
	const [showVehiclePaths] = useLocalStorage("show-vehicle-paths", true);
	const [stopLabelsStyle, setStopLabelsStyle] = useLocalStorage<StopLabelsStyle>(
		"stop-labels-style",
		"without-background",
	);

	if (!showVehiclePaths) {
		return null;
	}

	return (
		<div>
			<Label className="block mb-1 text-base">Affichage des arrêts sur la carte</Label>
			<Tabs
				value={stopLabelsStyle}
				onValueChange={(value) => setStopLabelsStyle(value as StopLabelsStyle)}
				className="w-full"
			>
				<TabsList className="grid w-full grid-cols-3">
					<TabsTrigger value="disabled">Non</TabsTrigger>
					<TabsTrigger value="without-background">Sans fond</TabsTrigger>
					<TabsTrigger value="with-background">Avec fond</TabsTrigger>
				</TabsList>
			</Tabs>
		</div>
	);
}
