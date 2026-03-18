import { type VehicleJourney, vehicleJourneySchema } from "@bus-tracker/contracts";
import { ArkErrors } from "arktype";

import { handleVehicleBatch } from "./handle-vehicle-batch.js";

declare var self: Worker;

self.onmessage = async (event: MessageEvent<string>) => {
	const message = event.data;
	let didWarn = false;
	let vehicleJourneys: VehicleJourney[];

	try {
		const payload = JSON.parse(message);
		if (!Array.isArray(payload)) throw new Error("Payload is not an array");
		vehicleJourneys = payload.flatMap((entry) => {
			const result = vehicleJourneySchema(entry);

			if (result instanceof ArkErrors) {
				if (!didWarn) {
					console.warn(`Rejected object(s) from journeys channel, sample:`, entry);
					console.error(result.toString());
					didWarn = true;
				}
				return [];
			}

			return result;
		});
	} catch (error) {
		console.error(error);
		return;
	}

	const processedJourneys = await handleVehicleBatch(vehicleJourneys);
	self.postMessage(processedJourneys);
};
