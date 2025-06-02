import "dotenv";

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

await initializeResources(configuration.sources);
setInterval(() => updateResources(configuration.sources), 600_000);
setInterval(() => sweepJourneys(configuration.sources), 36_000_000);
new Cron("0 0 0 * * *", () => computeNextJourneys(configuration.sources));

// ---

let isBusy = false;

async function computeCurrentJourneys() {
	const watch = createStopWatch();

	if (isBusy) {
		console.warn("%s ► Ignoring cycle as previous one hasn't ended yet.", Temporal.Now.instant());
		return;
	}

	isBusy = true;
	const computeLimit = 6;
	const computeLimitFn = pLimit(computeLimit);
	const updateLog = console.draft("%s ► Computing vehicle journeys to publish.", Temporal.Now.instant());

	try {
		const computationResults = await Promise.allSettled(
			configuration.sources.map((source) =>
				computeLimitFn(async () => {
					if (typeof source.gtfs === "undefined") return 0;
					const journeys = await computeVehicleJourneys(source);
					redis.publish(channel, JSON.stringify(journeys));
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
	isBusy = false;
}

await computeCurrentJourneys();
setInterval(computeCurrentJourneys, configuration.computeDelayMs);
