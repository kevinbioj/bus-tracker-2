import { useLocalStorage } from "usehooks-ts";

import { Label } from "~/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import type { StopLabelsStyle } from "~/components/vehicles-map/stop-labels-style";
import * as m from "~/paraglide/messages";

export function StopLabelsStyleSetting() {
	const [showVehiclePaths] = useLocalStorage("show-vehicle-paths", true);
	const [stopLabelsStyle, setStopLabelsStyle] = useLocalStorage<StopLabelsStyle>(
		"stop-labels-style",
		"with-background",
	);

	if (!showVehiclePaths) {
		return null;
	}

	return (
		<div>
			<Label className="block mb-1 text-base">{m.settings_stop_labels_style_label()}</Label>
			<Tabs
				value={stopLabelsStyle}
				onValueChange={(value) => setStopLabelsStyle(value as StopLabelsStyle)}
				className="w-full"
			>
				<TabsList className="grid w-full grid-cols-3">
					<TabsTrigger value="disabled">{m.settings_stop_labels_style_disabled()}</TabsTrigger>
					<TabsTrigger value="without-background">{m.settings_stop_labels_style_without_background()}</TabsTrigger>
					<TabsTrigger value="with-background">{m.settings_stop_labels_style_with_background()}</TabsTrigger>
				</TabsList>
			</Tabs>
		</div>
	);
}
