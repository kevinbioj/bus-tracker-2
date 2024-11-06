import type { VehicleJourney } from "@bus-tracker/contracts";
import pLimit from "p-limit";
import { Temporal } from "temporal-polyfill";

import { importLine } from "../import/import-line.js";
import { importNetwork } from "../import/import-network.js";
import { registerActivity } from "./register-activity.js";

export async function handleVehicleBatch(vehicleJourneys: VehicleJourney[]) {
	const limitRegister = pLimit(1);

	for (const vehicleJourney of vehicleJourneys) {
		const timeSince = Temporal.Now.instant().since(vehicleJourney.updatedAt);
		if (timeSince.total("minutes") >= 10) return;

		await importNetwork(vehicleJourney.networkRef);
		if (typeof vehicleJourney.line !== "undefined")
			await importLine(vehicleJourney.networkRef, vehicleJourney.line, Temporal.Now.instant());

		limitRegister(() => registerActivity(vehicleJourney)).catch((error) => {});
	}
}
