import type { VehicleJourney, VehicleJourneyLine } from "@bus-tracker/contracts";

import type { DisposeableVehicleJourney } from "../types/disposeable-vehicle-journey.js";
import { keyBy } from "../utils/key-by.js";
import { nthIndexOf } from "../utils/nth-index-of.js";

import { importLines } from "./import/import-lines.js";
import { importNetwork } from "./import/import-network.js";
import { importVehicles } from "./import/import-vehicles.js";
import { registerActivities } from "./register-activities.js";

export async function handleVehicleBatch(vehicleJourneys: VehicleJourney[]) {
	const now = Temporal.Now.instant();

	const vehicleJourneysByNetwork = Map.groupBy(vehicleJourneys, (vehicleJourney) => vehicleJourney.networkRef);

	const allProcessedJourneys: DisposeableVehicleJourney[] = [];

	for (const [networkRef, vehicleJourneys] of vehicleJourneysByNetwork) {
		const network = await importNetwork(networkRef);

		const [lineDatas, vehicleRefs] = vehicleJourneys.reduce(
			([lineDataAcc, vehicleRefAcc], vehicleJourney) => {
				if (vehicleJourney.line !== undefined) {
					lineDataAcc.set(vehicleJourney.line.ref, vehicleJourney.line);
				}

				if (networkRef !== "SNCF" && vehicleJourney.vehicleRef !== undefined) {
					vehicleRefAcc.add(vehicleJourney.vehicleRef);
				}

				return [lineDataAcc, vehicleRefAcc];
			},
			[new Map<string, VehicleJourneyLine>(), new Set<string>()],
		);

		const lines = keyBy(await importLines(network, Array.from(lineDatas.values()), now), (line) => line.references!);
		const vehicles = network.hasVehiclesFeature
			? keyBy(await importVehicles(network, vehicleRefs), (vehicle) => vehicle.ref)
			: undefined;

		const registerableActivities = [];

		for (const vehicleJourney of vehicleJourneys) {
			const line = vehicleJourney.line ? lines.get(vehicleJourney.line.ref) : undefined;

			const disposeableJourney: DisposeableVehicleJourney = {
				id: vehicleJourney.id.replaceAll("/", "_"),
				lineId: line?.id,
				direction: vehicleJourney.direction,
				destination: vehicleJourney.destination,
				calls: vehicleJourney.calls,
				position: vehicleJourney.position,
				pathRef: vehicleJourney.pathRef,
				occupancy: vehicleJourney.occupancy,
				networkId: network.id,
				operatorId: undefined,
				vehicle: undefined,
				serviceDate: vehicleJourney.serviceDate,
				updatedAt: vehicleJourney.updatedAt,
			};

			allProcessedJourneys.push(disposeableJourney);

			if (vehicleJourney.vehicleRef !== undefined) {
				const vehicle = vehicles?.get(vehicleJourney.vehicleRef);
				if (vehicle !== undefined) {
					disposeableJourney.vehicle = {
						id: vehicle.id,
						number: vehicle.number,
					};

					registerableActivities.push(disposeableJourney);
				} else {
					disposeableJourney.vehicle = {
						number: vehicleJourney.vehicleRef.slice(nthIndexOf(vehicleJourney.vehicleRef, ":", 3) + 1),
					};
				}
			}
		}

		if (network.hasVehiclesFeature) {
			registerActivities(registerableActivities);
		}
	}

	return allProcessedJourneys;
}
