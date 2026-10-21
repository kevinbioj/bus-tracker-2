import { eq } from "drizzle-orm";

import type { DisposeableVehicleJourney } from "../../types/disposeable-vehicle-journey.js";
import { database } from "../database/database.js";
import { vehiclesTable } from "../database/schema.js";
import { findGirouette } from "./girouette-service.js";

export async function buildJourneyDetails(journey: DisposeableVehicleJourney) {
	const vehicle = journey.vehicle?.id
		? (
				await database
					.select({
						type: vehiclesTable.type,
						designation: vehiclesTable.designation,
						airConditioning: vehiclesTable.airConditioning,
						usbPorts: vehiclesTable.usbPorts,
					})
					.from(vehiclesTable)
					.where(eq(vehiclesTable.id, journey.vehicle.id))
			).at(0)
		: undefined;

	const girouette = await findGirouette({
		networkId: journey.networkId,
		lineId: journey.lineId,
		directionId: journey.direction === "OUTBOUND" ? 0 : 1,
		destination: journey.destination ?? journey.calls?.findLast((call) => call.callStatus !== "SKIPPED")?.stopName,
	});

	// La référence du tracé abandonné reste interne : les deux tracés de la course sont servis
	// ensemble par `/vehicle-journeys/:id/paths`, le client n'a pas à la connaître.
	const { cancelledPathRef, ...exposedJourney } = journey;

	return {
		...exposedJourney,
		vehicle: journey.vehicle
			? {
					...journey.vehicle,
					type: vehicle?.type ?? undefined,
					designation: vehicle?.designation ?? undefined,
					airConditioning: vehicle?.airConditioning ?? undefined,
					usbPorts: vehicle?.usbPorts ?? undefined,
				}
			: undefined,
		girouette: girouette?.data,
	};
}

export type JourneyDetails = Awaited<ReturnType<typeof buildJourneyDetails>>;
