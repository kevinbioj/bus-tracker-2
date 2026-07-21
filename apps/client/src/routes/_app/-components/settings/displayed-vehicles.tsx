import { useQueryClient } from "@tanstack/react-query";
import { SatelliteDishIcon } from "lucide-react";

import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";
import {
	type PositionType,
	positionTypes,
	useDisplayedPositionTypes,
} from "~/components/vehicles-map/displayed-position-types";
import * as m from "~/paraglide/messages";
import { cn } from "~/utils/cn";

const positionTypeDetails = {
	GPS: {
		iconClass: "text-green-600",
		checkedClass: "border-green-600 bg-green-600/20",
		checkboxClass: "data-checked:border-green-600 data-checked:bg-green-600 dark:data-checked:bg-green-600",
		label: m.settings_displayed_vehicles_gps,
	},
	ESTIMATED: {
		iconClass: "text-orange-500",
		checkedClass: "border-orange-500 bg-orange-500/20",
		checkboxClass: "data-checked:border-orange-500 data-checked:bg-orange-500 dark:data-checked:bg-orange-500",
		label: m.settings_displayed_vehicles_estimated,
	},
	SCHEDULED: {
		iconClass: "text-red-600",
		checkedClass: "border-red-600 bg-red-600/20",
		checkboxClass: "data-checked:border-red-600 data-checked:bg-red-600 dark:data-checked:bg-red-600",
		label: m.settings_displayed_vehicles_scheduled,
	},
} as const satisfies Record<
	PositionType,
	{ iconClass: string; checkedClass: string; checkboxClass: string; label: () => string }
>;

export function DisplayedVehiclesSetting() {
	const queryClient = useQueryClient();
	const [displayedPositionTypes, setDisplayedPositionTypes] = useDisplayedPositionTypes();

	const onChange = (type: PositionType, checked: boolean) => {
		setDisplayedPositionTypes(
			positionTypes.filter((value) => (value === type ? checked : displayedPositionTypes.includes(value))),
		);
		queryClient.refetchQueries({ queryKey: ["vehicle-journeys"] });
	};

	return (
		<fieldset>
			<legend className="text-base font-medium">{m.settings_displayed_vehicles_label()}</legend>
			<p className="mb-2 text-sm text-muted-foreground">{m.settings_displayed_vehicles_description()}</p>
			<div className="grid grid-cols-3 gap-2">
				{positionTypes.map((type) => {
					const { iconClass, checkedClass, checkboxClass, label } = positionTypeDetails[type];
					const checked = displayedPositionTypes.includes(type);

					return (
						<Label
							key={type}
							className={cn(
								"items-center gap-2 rounded-md border p-2 text-xs cursor-pointer transition-colors has-disabled:cursor-not-allowed has-disabled:opacity-50",
								checked ? checkedClass : "bg-card",
							)}
						>
							<Checkbox
								checked={checked}
								className={cn("rounded-sm", checkboxClass)}
								disabled={checked && displayedPositionTypes.length === 1}
								onCheckedChange={(value) => onChange(type, value)}
							/>
							<SatelliteDishIcon className={cn("size-4 shrink-0", iconClass)} />
							{label()}
						</Label>
					);
				})}
			</div>
		</fieldset>
	);
}
