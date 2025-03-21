import type { VehicleJourney, VehicleJourneyLine } from "@bus-tracker/contracts";
import { Temporal } from "temporal-polyfill";

import type { Network } from "../database/schema.js";
import { importLines } from "../import/import-lines.js";
import { importNetworks } from "../import/import-networks.js";
import { importVehicle } from "../import/import-vehicle.js";
import type { JourneyStore } from "../store/journey-store.js";
import type { DisposeableVehicleJourney } from "../types/disposeable-vehicle-journey.js";
import { nthIndexOf } from "../utils/nth-index-of.js";

import { registerActivity } from "./register-activity.js";

export async function handleVehicleBatch(store: JourneyStore, vehicleJourneys: VehicleJourney[]) {
	const now = Temporal.Now.instant();

	const networkRefs = vehicleJourneys.reduce(
		(acc, vehicleJourney) => acc.add(vehicleJourney.networkRef),
		new Set<string>(),
	);

	const networks = (await importNetworks(networkRefs)).reduce((map, network) => {
		map.set(network.ref, network);
		return map;
	}, new Map<string, Network>());

	const lines = (
		await Promise.all(
			networks.values().map((network) => {
				const lineDatas = vehicleJourneys.reduce((map, vehicleJourney) => {
					if (typeof vehicleJourney.line !== "undefined" && !map.has(vehicleJourney.line.ref)) {
						map.set(vehicleJourney.line.ref, vehicleJourney.line);
					}
					return map;
				}, new Map<string, VehicleJourneyLine>());
				return importLines(network, Array.from(lineDatas.values()), now);
			}),
		)
	).flat();

	// const limitRegister = pLimit(100);
	for (const vehicleJourney of vehicleJourneys) {
		const timeSince = Temporal.Now.instant().since(vehicleJourney.updatedAt);
		if (timeSince.total("minutes") >= 10) return;
		// limitRegister(async () => {
		const network = networks.get(vehicleJourney.networkRef)!;
		const line = vehicleJourney.line
			? lines.find(({ references }) => references?.includes(vehicleJourney.line!.ref))
			: undefined;

		const disposeableJourney: DisposeableVehicleJourney = {
			id: vehicleJourney.id,
			lineId: line?.id,
			direction: vehicleJourney.direction,
			destination: vehicleJourney.destination,
			calls: vehicleJourney.calls,
			position: vehicleJourney.position,
			occupancy: vehicleJourney.occupancy,
			networkId: network.id,
			operatorId: undefined,
			vehicle: undefined,
			serviceDate: vehicleJourney.serviceDate,
			updatedAt: vehicleJourney.updatedAt,
		};

		if (typeof vehicleJourney.vehicleRef !== "undefined") {
			if (vehicleJourney.networkRef !== "SNCF") {
				const vehicle = await importVehicle(network, vehicleJourney.vehicleRef);
				disposeableJourney.vehicle = { id: vehicle.id, number: vehicle.number };
				if (typeof vehicleJourney.line !== "undefined") {
					registerActivity(disposeableJourney);
				}
			} else {
				disposeableJourney.vehicle = {
					number: vehicleJourney.vehicleRef.slice(nthIndexOf(vehicleJourney.vehicleRef, ":", 3) + 1),
				};
			}
		}

		store.set(disposeableJourney.id, disposeableJourney);
		// });
	}
}
