import { parentPort } from "node:worker_threads";
import { type VehicleJourney, vehicleJourneySchema } from "@bus-tracker/contracts";
import { ArkErrors } from "arktype";
import { createClient } from "redis";

import { handleVehicleBatch } from "./handle-vehicle-batch.js";

export const redis = createClient({
	socket: process.env.REDIS_SOCK
		? {
				path: process.env.REDIS_SOCK,
				tls: process.env.REDIS_TLS === "true",
			}
		: undefined,
	url: process.env.REDIS_SOCK ? undefined : process.env.REDIS_URL,
});

const redisSubscriber = redis.duplicate();

redis.on("error", (error) => {
	console.error("✘ [Worker] An error occurred with Redis-client:", error);
});

redisSubscriber.on("error", (error) => {
	console.error("✘ [Worker] An error occurred with Redis-subscriber:", error);
});

async function start() {
	console.log("► [Worker] Connecting to Redis.");
	await redis.connect();
	await redisSubscriber.connect();

	console.log("► [Worker] Subscribing to journeys channel.");
	let processingPromise: Promise<void> | null = null;
	const messageQueue: string[] = [];

	const processQueue = async () => {
		while (messageQueue.length > 0) {
			const messages = messageQueue.splice(0);
			let didWarn = false;
			const vehicleJourneys: VehicleJourney[] = [];

			for (const message of messages) {
				try {
					const payload = JSON.parse(message);
					if (!Array.isArray(payload)) continue;
					for (const entry of payload) {
						const result = vehicleJourneySchema(entry);
						if (result instanceof ArkErrors) {
							if (!didWarn) {
								console.warn(`⚠ [Worker] Rejected object(s) from journeys channel, sample:`, entry);
								console.error(result.toString());
								didWarn = true;
							}
							continue;
						}
						vehicleJourneys.push(result);
					}
				} catch (error) {
					console.error("✘ [Worker] An error occurred while parsing batch:", error);
				}
			}

			if (vehicleJourneys.length > 0) {
				const processedJourneys = await handleVehicleBatch(vehicleJourneys);
				parentPort?.postMessage(processedJourneys);
			}
		}
	};

	await redisSubscriber.subscribe("journeys", (message) => {
		messageQueue.push(message);

		if (processingPromise !== null) return;

		processingPromise = processQueue()
			.catch((error) => {
				console.error("✘ [Worker] A worker-related error occurred while processing batch:", error);
			})
			.finally(() => {
				processingPromise = null;
			});
	});
}

start().catch((error) => {
	console.error("✘ An error occurred while starting thread:", error);
	throw error;
});
