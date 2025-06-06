import "dotenv";

import { setTimeout } from "node:timers/promises";
import { Cron } from "croner";
import DraftLog from "draftlog";
import pLimit from "p-limit";
import { createClient } from "redis";
import { Temporal } from "temporal-polyfill";

import { loadConfiguration } from "./configuration/load-configuration.js";
import { computeVehicleJourneys } from "./jobs/compute-current-journeys.js";
import { computeNextJourneys } from "./jobs/compute-next-journeys.js";
import { initializeResources } from "./jobs/initialize-resources.js";
import { sweepJourneys } from "./jobs/sweep-journeys.js";
import { updateResources } from "./jobs/update-resources.js";
import { configurationPath } from "./options.js";
import { createStopWatch } from "./utils/stop-watch.js";

DraftLog(console, !process.stdout.isTTY)?.addLineListener(process.stdin);

console.log(` ,----.,--------.,------.,---.   ,------.                                                         
'  .-./'--.  .--'|  .---'   .-'  |  .--. ',--.--. ,---.  ,---. ,---.  ,---.  ,---.  ,---. ,--.--. 
|  | .---.|  |   |  \`--,\`.  \`-.  |  '--' ||  .--'| .-. || .--'| .-. :(  .-' (  .-' | .-. ||  .--' 
'  '--'  ||  |   |  |\`  .-'    | |  | --' |  |   ' '-' '  \`--.    --..-'  \`).-'  \`)' '-' '|  |    
 \`------' \`--'   \`--'   \`-----'  \`--'     \`--'    \`---'  \`---' \`----'\`----' \`----'  \`---' \`--'    \n\n`);

const configuration = await loadConfiguration(configurationPath);

console.log("%s ► Connecting to Redis.", Temporal.Now.instant());
const redis = createClient(configuration.redisOptions);
const channel = process.env.REDIS_CHANNEL ?? "journeys";
await redis.connect();
console.log("%s ► Connected! Journeys will be published into '%s'.", Temporal.Now.instant(), channel);
console.log();

new Cron("0 0 0 * * *", () => computeNextJourneys(configuration.sources));

let lastUpdateAt = Date.now();
let lastSweepAt = Date.now();

await initializeResources(configuration.sources);
while (true) {
	console.log("%s ► Entering loop cycle.", Temporal.Now.instant());

	if (Date.now() - lastUpdateAt > 600_000) {
		await updateResources(configuration.sources);
		lastUpdateAt = Date.now();
	}

	if (Date.now() - lastSweepAt > 3600_000) {
		sweepJourneys(configuration.sources);
		lastSweepAt = Date.now();
	}

	const startedAt = Date.now();
	try {
		let timedOut = false;

		await Promise.race([
			computeCurrentJourneys(),
			(async () => {
				await setTimeout(30_000);
				timedOut = true;
			})(),
		]);

		if (timedOut) {
			console.error("Time out when computing journeys, restarting processor.");
			process.exit(1);
		}
	} catch (e) {
		console.error("Failed to compute current journeys", e);
	}
	const computeDuration = Date.now() - startedAt;

	// Wait at least 10s and at most 120s between each computation
	const timeToWait = Math.min(120_000, Math.max(10_000, configuration.computeDelayMs - computeDuration));
	console.log("%s ► Done loop cycle, waiting for %dms.", Temporal.Now.instant(), timeToWait);
	try {
		await setTimeout(timeToWait);
	} catch {}
}

async function computeCurrentJourneys() {
	const watch = createStopWatch();

	const computeLimit = 6;
	const computeLimitFn = pLimit(computeLimit);
	const updateLog = console.draft("%s ► Computing vehicle journeys to publish.", Temporal.Now.instant());

	try {
		const computationResults = await Promise.allSettled(
			configuration.sources.map((source) =>
				computeLimitFn(async () => {
					if (typeof source.gtfs === "undefined") return 0;
					const journeys = await computeVehicleJourneys(source);
					for (let i = 0; i < journeys.length; i += 500) {
						const chunk = journeys.slice(i, Math.min(i + 500, journeys.length));
						await redis.publish(channel, JSON.stringify(chunk));
					}
					return journeys.length;
				}),
			),
		);

		let computedJourneyCount = 0;
		for (const computationResult of computationResults) {
			if (computationResult.status === "rejected") {
				console.error(computationResult.reason);
				continue;
			}
			computedJourneyCount += computationResult.value;
		}

		updateLog(
			"%s ✓ Published %d vehicle journey entries in %dms.",
			Temporal.Now.instant(),
			computedJourneyCount,
			watch.total(),
		);
	} catch (e) {
		updateLog("%s ✘ Something wrong occurred while publishing vehicle journeys.", Temporal.Now.instant());
		console.error(e);
	}

	console.log();
}
