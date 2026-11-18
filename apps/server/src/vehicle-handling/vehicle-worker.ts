import { parentPort } from "node:worker_threads";
import { VEHICLE_JOURNEYS_CHANNEL, type VehicleJourney, vehicleJourneySchema } from "@bus-tracker/contracts";
import { createRedisClient } from "@bus-tracker/redis";
import { ArkErrors } from "arktype";

import { handleVehicleBatch } from "./handle-vehicle-batch.js";

const redisSubscriber = createRedisClient({ name: "worker subscriber" });

const MAX_QUEUED_BYTES = 64 * 1024 * 1024;
const DROP_WARNING_INTERVAL_MS = 60_000;

async function start() {
	console.log("► [Worker] Connecting to Redis.");
	await redisSubscriber.connect();

	console.log("► [Worker] Subscribing to journeys channel.");
	let processingPromise: Promise<void> | null = null;
	const messageQueue: string[] = [];
	let queuedBytes = 0;
	let droppedMessages = 0;
	let lastDropWarningAt = 0;

	const processQueue = async () => {
		while (messageQueue.length > 0) {
			const messages = messageQueue.splice(0);
			queuedBytes = 0;
			let didWarn = false;
			const vehicleJourneys: VehicleJourney[] = [];
			const now = Temporal.Now.instant();
			const nowIso = now.toString();

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
						if (Temporal.Instant.compare(result.position.recordedAt, now) > 0) result.position.recordedAt = nowIso;
						if (Temporal.Instant.compare(result.updatedAt, now) > 0) result.updatedAt = nowIso;
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

	await redisSubscriber.subscribe(VEHICLE_JOURNEYS_CHANNEL, (message) => {
		messageQueue.push(message);
		queuedBytes += message.length;

		while (queuedBytes > MAX_QUEUED_BYTES && messageQueue.length > 1) {
			queuedBytes -= messageQueue.shift()!.length;
			droppedMessages += 1;
		}

		if (droppedMessages > 0 && Date.now() - lastDropWarningAt > DROP_WARNING_INTERVAL_MS) {
			console.warn(`⚠ [Worker] Journeys queue is full, dropped ${droppedMessages} oldest message(s).`);
			droppedMessages = 0;
			lastDropWarningAt = Date.now();
		}

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
