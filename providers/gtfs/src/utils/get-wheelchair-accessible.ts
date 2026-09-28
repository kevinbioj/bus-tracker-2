import { match } from "ts-pattern";

import type { VehicleDescriptor } from "../model/gtfs-rt.js";
import type { Trip } from "../model/trip.js";

/**
 * Accessibilité de la course en fauteuil roulant : celle annoncée par un descripteur de véhicule
 * prime sur celle du GTFS statique (spec), sauf `NO_VALUE`, qui passe la main au suivant. Les
 * descripteurs sont donnés par priorité décroissante (VehiclePosition, puis TripUpdate).
 */
export function getWheelchairAccessible(
	trip: Trip | undefined,
	...vehicleDescriptors: (VehicleDescriptor | undefined)[]
) {
	const override = vehicleDescriptors.find(
		(descriptor) => descriptor?.wheelchairAccessible !== undefined && descriptor.wheelchairAccessible !== "NO_VALUE",
	);
	return match(override?.wheelchairAccessible)
		.with("WHEELCHAIR_ACCESSIBLE", () => true)
		.with("WHEELCHAIR_INACCESSIBLE", () => false)
		.with("UNKNOWN", () => undefined)
		.otherwise(() => trip?.wheelchairAccessible);
}
