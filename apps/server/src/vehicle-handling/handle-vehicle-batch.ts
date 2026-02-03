import type { VehicleJourney, VehicleJourneyLine } from "@bus-tracker/contracts";
import pLimit from "p-limit";
import { Temporal } from "temporal-polyfill";

import type { VehicleEntity } from "../core/database/schema.js";
import { journeyStore } from "../core/store/journey-store.js";
import type { DisposeableVehicleJourney } from "../types/disposeable-vehicle-journey.js";
import { nthIndexOf } from "../utils/nth-index-of.js";

import { importLines } from "./import/import-lines.js";
import { importNetwork } from "./import/import-network.js";
import { importVehicles } from "./import/import-vehicle.js";
import { registerActivity } from "./register-activity.js";

const limitRegister = pLimit(240);

export async function handleVehicleBatch(vehicleJourneys: VehicleJourney[]) {
	const now = Temporal.Now.instant();

	const vehicleJourneysByNetwork = Map.groupBy(vehicleJourneys, (vehicleJourney) => vehicleJourney.networkRef);

	for (const [networkRef, vehicleJourneys] of vehicleJourneysByNetwork) {
		const network = await importNetwork(networkRef);

		const [lineDatas, vehicleRefs] = vehicleJourneys.reduce(
			([lineDataAcc, vehicleRefAcc], vehicleJourney) => {
				if (typeof vehicleJourney.line !== "undefined") {
					lineDataAcc.set(vehicleJourney.line.ref, vehicleJourney.line);
				}

				if (networkRef !== "SNCF" && typeof vehicleJourney.vehicleRef !== "undefined") {
					vehicleRefAcc.add(vehicleJourney.vehicleRef);
				}

				return [lineDataAcc, vehicleRefAcc];
			},
			[new Map<string, VehicleJourneyLine>(), new Set<string>()],
		);

		const lines = await importLines(network, Array.from(lineDatas.values()), now);
		const vehicles = (await importVehicles(network, vehicleRefs)).reduce((map, vehicle) => {
			map.set(vehicle.ref, vehicle);
			return map;
		}, new Map<string, VehicleEntity>());

		for (const vehicleJourney of vehicleJourneys) {
			const timeSince = Temporal.Now.instant().since(vehicleJourney.updatedAt);
			if (timeSince.total("minutes") >= 10) continue;

			limitRegister(async () => {
				const line = vehicleJourney.line
					? lines.find(({ references }) => references?.includes(vehicleJourney.line!.ref))
					: undefined;

				const disposeableJourney: DisposeableVehicleJourney = {
					id: vehicleJourney.id.replaceAll("/", "_"),
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

				journeyStore.set(disposeableJourney.id, disposeableJourney);

				if (typeof vehicleJourney.vehicleRef !== "undefined") {
					const vehicle = vehicles.get(vehicleJourney.vehicleRef);
					if (typeof vehicle !== "undefined") {
						disposeableJourney.vehicle = {
							id: vehicle.id,
							number: vehicle.number,
						};

						await registerActivity(disposeableJourney);
					} else if (networkRef === "SNCF") {
						disposeableJourney.vehicle = {
							number: vehicleJourney.vehicleRef.slice(nthIndexOf(vehicleJourney.vehicleRef, ":", 3) + 1),
						};
					}
				}
			});
		}
	}
}
