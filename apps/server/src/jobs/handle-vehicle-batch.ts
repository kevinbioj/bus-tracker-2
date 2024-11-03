import type { VehicleJourney } from "@bus-tracker/contracts";
import pLimit from "p-limit";
import { Temporal } from "temporal-polyfill";

import { registerActivity } from "./register-activity.js";

export async function handleVehicleBatch(vehicleJourneys: VehicleJourney[]) {
	const limitRegister = pLimit(1);

	for (const vehicleJourney of vehicleJourneys) {
		const timeSince = Temporal.Now.instant().since(vehicleJourney.updatedAt);
		if (timeSince.total("minutes") >= 10) return;

		limitRegister(() => registerActivity(vehicleJourney)).catch((error) => {});
	}
}
