import type { VehicleJourney, VehicleJourneyLine } from "@bus-tracker/contracts";
import pLimit from "p-limit";
import { Temporal } from "temporal-polyfill";

import type { Network } from "../database/schema.js";
import { importLine } from "../import/import-line.js";
import { importNetwork } from "../import/import-network.js";

import { registerActivity } from "./register-activity.js";

export async function handleVehicleBatch(vehicleJourneys: VehicleJourney[]) {
	const now = Temporal.Now.instant();

	const networkRefs = vehicleJourneys.reduce(
		(acc, vehicleJourney) => acc.add(vehicleJourney.networkRef),
		new Set<string>(),
	);

	const networks = (await Promise.all(networkRefs.values().map((networkRef) => importNetwork(networkRef)))).reduce(
		(acc, network) => acc.set(network.ref, network),
		new Map<string, Network>(),
	);

	const linesByRef = vehicleJourneys.reduce(
		(acc, vehicleJourney) => (vehicleJourney.line ? acc.set(vehicleJourney.line.ref, vehicleJourney.line) : acc),
		new Map<string, VehicleJourneyLine>(),
	);

	const lines = await Promise.all(
		linesByRef.values().map((line) => {
			const networkRef = line.ref.slice(0, line.ref.indexOf(":"));
			const network = networks.get(networkRef)!;
			return importLine(network, line, now);
		}),
	);

	const limitRegister = pLimit(100);
	for (const vehicleJourney of vehicleJourneys) {
		const timeSince = Temporal.Now.instant().since(vehicleJourney.updatedAt);
		if (timeSince.total("minutes") >= 10) return;
		limitRegister(() =>
			registerActivity(
				vehicleJourney,
				networks.get(vehicleJourney.networkRef)!,
				vehicleJourney.line ? lines.find((line) => line.references?.includes(vehicleJourney.line!.ref)) : undefined,
			),
		);
	}
}
