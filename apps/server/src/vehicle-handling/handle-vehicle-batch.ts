import type { VehicleJourney, VehicleJourneyLine } from "@bus-tracker/contracts";

import type { DisposeableVehicleJourney } from "../types/disposeable-vehicle-journey.js";
import { mapWithConcurrency } from "../utils/map-with-concurrency.js";
import { nthIndexOf } from "../utils/nth-index-of.js";

import { importLines } from "./import/import-lines.js";
import { importNetwork } from "./import/import-network.js";
import { importVehicles } from "./import/import-vehicles.js";
import { registerActivities } from "./register-activities.js";

/**
 * Réseaux traités en parallèle. Un réseau n'apparaît qu'une fois par lot, quel que soit le nombre de
 * sources qui l'alimentent : deux réseaux traités ensemble n'écrivent jamais les mêmes lignes de table.
 * La limite laisse de la marge dans le pool de connexions du worker.
 */
const NETWORK_CONCURRENCY = 4;

/**
 * Ne garde que la dernière publication de chaque course. Les messages en attente sont traités en un
 * seul lot : un worker en retard y trouve plusieurs cycles d'un même provider, donc plusieurs
 * publications d'une même course, dont seule la dernière est à jour.
 */
export function keepLatestJourneys(vehicleJourneys: VehicleJourney[]) {
	const latest = new Map<string, VehicleJourney>();
	for (const vehicleJourney of vehicleJourneys) {
		latest.delete(vehicleJourney.id);
		latest.set(vehicleJourney.id, vehicleJourney);
	}
	return Array.from(latest.values());
}

export async function handleVehicleBatch(vehicleJourneys: VehicleJourney[]) {
	const now = Temporal.Now.instant();

	const vehicleJourneysByNetwork = Map.groupBy(
		keepLatestJourneys(vehicleJourneys),
		(vehicleJourney) => vehicleJourney.networkRef,
	);

	// Un réseau en échec n'emporte que ses propres courses : sans cela, une seule erreur (une ligne
	// impossible à importer, par exemple) viderait la carte de tous les réseaux du lot.
	const processedJourneysByNetwork = await mapWithConcurrency(
		vehicleJourneysByNetwork,
		NETWORK_CONCURRENCY,
		([networkRef, vehicleJourneys]) =>
			handleNetworkJourneys(networkRef, vehicleJourneys, now).catch((error) => {
				console.error(`✘ [Worker] Failed to handle journeys of network '${networkRef}':`, error);
				return [];
			}),
	);

	return processedJourneysByNetwork.flat();
}

async function handleNetworkJourneys(networkRef: string, vehicleJourneys: VehicleJourney[], now: Temporal.Instant) {
	const processedJourneys: DisposeableVehicleJourney[] = [];

	const network = await importNetwork(networkRef);

	const [lineDatas, vehicleRefs] = vehicleJourneys.reduce(
		([lineDataAcc, vehicleRefAcc], vehicleJourney) => {
			if (vehicleJourney.line !== undefined) {
				lineDataAcc.set(vehicleJourney.line.ref, vehicleJourney.line);
			}

			if (vehicleJourney.hasRealVehicle !== false && vehicleJourney.vehicleRef !== undefined) {
				vehicleRefAcc.add(vehicleJourney.vehicleRef);
			}

			return [lineDataAcc, vehicleRefAcc];
		},
		[new Map<string, VehicleJourneyLine>(), new Set<string>()],
	);

	const lines = await importLines(network, Array.from(lineDatas.values()), now);
	const vehicles = network.hasVehiclesFeature ? await importVehicles(network, vehicleRefs) : undefined;

	const registerableActivities = [];

	for (const vehicleJourney of vehicleJourneys) {
		const line = vehicleJourney.line ? lines.get(vehicleJourney.line.ref) : undefined;

		const disposeableJourney: DisposeableVehicleJourney = {
			id: vehicleJourney.id.replaceAll("/", "_"),
			countryCode: network.countryCode,
			lineId: line?.id,
			direction: vehicleJourney.direction,
			destination: vehicleJourney.destination,
			calls: vehicleJourney.calls,
			position: vehicleJourney.position,
			pathRef: vehicleJourney.pathRef,
			cancelledPathRef: vehicleJourney.cancelledPathRef,
			isAdded: vehicleJourney.isAdded,
			occupancy: vehicleJourney.occupancy,
			networkId: network.id,
			journeyRef: vehicleJourney.journeyRef,
			operatorId: undefined,
			vehicle: undefined,
			missionCode: vehicleJourney.missionCode,
			wheelchairAccessible: vehicleJourney.wheelchairAccessible,
			bikesAllowed: vehicleJourney.bikesAllowed,
			serviceDate: vehicleJourney.serviceDate,
			updatedAt: vehicleJourney.updatedAt,
		};

		processedJourneys.push(disposeableJourney);

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
		await registerActivities(registerableActivities);
	}

	return processedJourneys;
}
