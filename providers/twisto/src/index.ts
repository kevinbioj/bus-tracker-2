import { setTimeout } from "node:timers/promises";
import { captureException, initMonitoring } from "@bus-tracker/monitoring";
import { createClient } from "redis";
import { Temporal } from "temporal-polyfill";

import { fetchMonitoredLines } from "./jobs/fetch-monitored-lines.js";
import { fetchMonitoredVehicles } from "./jobs/fetch-monitored-vehicles.js";

initMonitoring("processor-twisto");

console.log("%s ► Connecting to Redis.", Temporal.Now.instant());
const redis = createClient({
	socket: process.env.REDIS_SOCK
		? {
				path: process.env.REDIS_SOCK,
				tls: process.env.REDIS_TLS === "true",
			}
		: undefined,
	url: process.env.REDIS_SOCK ? undefined : (process.env.REDIS_URL ?? "redis://127.0.0.1:6379"),
});
const channel = process.env.REDIS_CHANNEL ?? "journeys";
await redis.connect();
console.log("%s ► Connected! Journeys will be published into '%s'.", Temporal.Now.instant(), channel);
console.log();

let monitoredLines: string[] = [];
let lastMonitoredLinesUpdate: number | undefined;

while (true) {
	if (lastMonitoredLinesUpdate === undefined || Date.now() - lastMonitoredLinesUpdate > 7200_000) {
		console.log("%s ► Fetching monitored lines.", Temporal.Now.instant());
		try {
			monitoredLines = await fetchMonitoredLines();
			lastMonitoredLinesUpdate = Date.now();
			console.log("%s ✓ %d have been registered", Temporal.Now.instant(), monitoredLines.length);
		} catch (cause) {
			console.error("%s ✘ Failed to update monitored lines", Temporal.Now.instant(), cause);
			captureException(cause);
		}
		await setTimeout(60_000);

		// Initial lines fetch did not work
		if (lastMonitoredLinesUpdate === undefined) {
			continue;
		}
	}

	console.log("%s ► Fetching active vehicle journeys...", Temporal.Now.instant());
	const vehicleJourneys = await fetchMonitoredVehicles(monitoredLines);
	await redis.publish(channel, JSON.stringify(vehicleJourneys));
	console.log("%s ✓ Sent %d vehicle journeys.", Temporal.Now.instant(), vehicleJourneys.length);
	await setTimeout(60_000);
}
