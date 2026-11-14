import { match } from "ts-pattern";

import type { Vehicle } from "~/api/vehicles";
import { BusIcon, CoachIcon, GondolaIcon, ShipIcon, TramwayIcon, TrolleybusIcon } from "~/icons/means-of-transport";

export function VehicleTypeTile({ type }: Readonly<{ type: Vehicle["type"] }>) {
	const Icon = match(type)
		.with("SUBWAY", "TRAMWAY", "RAIL", () => TramwayIcon)
		.with("TROLLEY", () => TrolleybusIcon)
		.with("COACH", () => CoachIcon)
		.with("FERRY", () => ShipIcon)
		.with("GONDOLA", () => GondolaIcon)
		.otherwise(() => BusIcon);

	return (
		<span
			aria-hidden="true"
			className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-foreground sm:size-12"
		>
			<Icon className="size-6" />
		</span>
	);
}
