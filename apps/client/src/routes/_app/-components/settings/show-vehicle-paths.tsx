import { useId } from "react";

import { Label } from "~/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { usePathDisplayMode } from "~/components/vehicles-map/path-display-mode";
import * as m from "~/paraglide/messages";

export function ShowVehiclePathsSetting() {
	const id = useId();
	const [pathDisplayMode, setPathDisplayMode] = usePathDisplayMode();

	return (
		<div>
			<Label htmlFor={id} className="block mb-1 text-base">
				{m.settings_show_vehicle_paths_label()}
			</Label>
			<Tabs value={pathDisplayMode} onValueChange={(value) => setPathDisplayMode(value as typeof pathDisplayMode)}>
				<TabsList className="grid h-auto w-full grid-cols-3" id={id}>
					<TabsTrigger className="whitespace-normal py-1.5 text-center leading-tight" value="disabled">
						{m.settings_show_vehicle_paths_disabled()}
					</TabsTrigger>
					<TabsTrigger className="whitespace-normal py-1.5 text-center leading-tight" value="journeys">
						{m.settings_show_vehicle_paths_journeys()}
					</TabsTrigger>
					<TabsTrigger className="whitespace-normal py-1.5 text-center leading-tight" value="journeys-and-lines">
						{m.settings_show_vehicle_paths_journeys_and_lines()}
					</TabsTrigger>
				</TabsList>
			</Tabs>
		</div>
	);
}
