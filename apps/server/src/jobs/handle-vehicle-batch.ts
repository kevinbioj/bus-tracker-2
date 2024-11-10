import type { VehicleJourney, VehicleJourneyLine } from "@bus-tracker/contracts";
import pLimit from "p-limit";
import { Temporal } from "temporal-polyfill";

import { importLine } from "../import/import-line.js";
import { importNetwork } from "../import/import-network.js";

import { registerActivity } from "./register-activity.js";

export async function handleVehicleBatch(vehicleJourneys: VehicleJourney[]) {
	const now = Temporal.Now.instant();

	const linesByNetwork = vehicleJourneys.reduce((acc, vehicleJourney) => {
		let network = acc.get(vehicleJourney.networkRef);
		if (typeof network === "undefined") {
			network = new Map<string, VehicleJourneyLine>();
			acc.set(vehicleJourney.networkRef, network);
		}

		if (typeof vehicleJourney.line !== "undefined" && !network.has(vehicleJourney.line.ref)) {
			network.set(vehicleJourney.line.ref, vehicleJourney.line);
		}

		return acc;
	}, new Map<string, Map<string, VehicleJourneyLine>>());

	await Promise.all(
		linesByNetwork.entries().map(async ([networkRef, lines]) => {
			await importNetwork(networkRef);
			await Promise.all(lines.values().map((line) => importLine(networkRef, line, now)));
		}),
	);

	const limitRegister = pLimit(100);
	for (const vehicleJourney of vehicleJourneys) {
		const timeSince = Temporal.Now.instant().since(vehicleJourney.updatedAt);
		if (timeSince.total("minutes") >= 10) return;
		limitRegister(() => registerActivity(vehicleJourney));
	}
}
