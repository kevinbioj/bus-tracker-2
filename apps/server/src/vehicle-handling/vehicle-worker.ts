import { type VehicleJourney, vehicleJourneySchema } from "@bus-tracker/contracts";
import { ArkErrors } from "arktype";
import { createClient } from "redis";

import { handleVehicleBatch } from "./handle-vehicle-batch.js";

declare var self: Worker;

const redis = createClient({
	url: process.env.REDIS_URL ?? "redis://localhost:6379",
});

async function start() {
	console.log("► [Worker] Connecting to Redis.");
	await redis.connect();

	console.log("► [Worker] Subscribing to journeys channel.");
	await redis.subscribe("journeys", async (message) => {
		try {
			let didWarn = false;
			let vehicleJourneys: VehicleJourney[];

			try {
				const payload = JSON.parse(message);
				if (!Array.isArray(payload)) throw new Error("Payload is not an array");
				vehicleJourneys = payload.flatMap((entry) => {
					const result = vehicleJourneySchema(entry);

					if (result instanceof ArkErrors) {
						if (!didWarn) {
							console.warn(`⚠ [Worker] Rejected object(s) from journeys channel, sample:`, entry);
							console.error(result.toString());
							didWarn = true;
						}
						return [];
					}

					return result;
				});
			} catch (error) {
				console.error("✘ [Worker] An error occurred while processing batch:", error);
				return;
			}

			const processedJourneys = await handleVehicleBatch(vehicleJourneys);
			self.postMessage(processedJourneys);
		} catch (error) {
			console.error("✘ [Worker] A worker-related error occurred while processing batch:", error);
		}
	});
}

start().catch((error) => {
	console.error("✘ An error occurred while starting thread:", error);
	throw error;
});
