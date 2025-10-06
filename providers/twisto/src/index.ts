import { setTimeout } from "node:timers/promises";
import { createClient } from "redis";
import { Temporal } from "temporal-polyfill";

import { fetchMonitoredLines } from "./jobs/fetch-monitored-lines.js";
import { fetchMonitoredVehicles } from "./jobs/fetch-monitored-vehicles.js";

console.log("%s ► Connecting to Redis.", Temporal.Now.instant());
const redis = createClient({
	url: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
	username: process.env.REDIS_USERNAME,
	password: process.env.REDIS_PASSWORD,
});
const channel = process.env.REDIS_CHANNEL ?? "journeys";
await redis.connect();
console.log("%s ► Connected! Journeys will be published into '%s'.", Temporal.Now.instant(), channel);
console.log();

let monitoredLines: string[] = [];
let lastMonitoredLinesUpdate: number | undefined;

while (true) {
	if (typeof lastMonitoredLinesUpdate === "undefined" || Date.now() - lastMonitoredLinesUpdate > 7200_000) {
		console.log("%s ► Fetching monitored lines.", Temporal.Now.instant());
		try {
			monitoredLines = await fetchMonitoredLines();
			lastMonitoredLinesUpdate = Date.now();
			console.log("%s ✓ %d have been registered", Temporal.Now.instant(), monitoredLines.length);
		} catch (cause) {
			console.error("%s ✘ Failed to update monitored lines", Temporal.Now.instant(), cause);
		}
		await setTimeout(600_000 + 5000); // 5s additional time
	}

	console.log("%s ► Fetching active vehicle journeys...", Temporal.Now.instant());
	const vehicleJourneys = await fetchMonitoredVehicles(monitoredLines);
	await redis.publish(channel, JSON.stringify(vehicleJourneys));
	console.log("%s ✓ Sent %d vehicle journeys.", Temporal.Now.instant(), vehicleJourneys.length);
	await setTimeout(600_000 + 5000); // 5s additional time
}
