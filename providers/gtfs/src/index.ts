import "dotenv";

import { VEHICLE_JOURNEYS_CHANNEL } from "@bus-tracker/contracts";
import { captureException, initMonitoring, shutdownMonitoring } from "@bus-tracker/monitoring";
import { createRedisClient } from "@bus-tracker/redis";
import { Cron } from "croner";
import DraftLog from "draftlog";
import pLimit from "p-limit";

import { loadConfiguration } from "./configuration/load-configuration.js";
import { createJourneyPathPublisher } from "./jobs/publish-journey-paths.js";
import { runSourceLoop } from "./jobs/run-source-loop.js";
import { serveStopDepartures } from "./jobs/serve-stop-departures.js";
import type { Source } from "./model/source.js";
import { configurationPath } from "./options.js";

const DEFAULT_SOURCE_COMPUTE_BUDGET_MS = 20_000;
const RESOURCE_IMPORT_CONCURRENCY = 2;
const GC_INTERVAL_MS = 300_000;

DraftLog(console, true)?.addLineListener(process.stdin);

console.log(` ,----.,--------.,------.,---.   ,------.                                                         
'  .-./'--.  .--'|  .---'   .-'  |  .--. ',--.--. ,---.  ,---. ,---.  ,---.  ,---.  ,---. ,--.--. 
|  | .---.|  |   |  \`--,\`.  \`-.  |  '--' ||  .--'| .-. || .--'| .-. :(  .-' (  .-' | .-. ||  .--' 
'  '--'  ||  |   |  |\`  .-'    | |  | --' |  |   ' '-' '  \`--.    --..-'  \`).-'  \`)' '-' '|  |    
 \`------' \`--'   \`--'   \`-----'  \`--'     \`--'    \`---'  \`---' \`----'\`----' \`----'  \`---' \`--'    \n\n`);

const configuration = await loadConfiguration(configurationPath);

initMonitoring(`processor-gtfs:${configuration.id}`);

console.log("%s ► Connecting to Redis.", Temporal.Now.instant());
// Après une coupure, Redis a pu perdre les tracés et l'inventaire : ils sont republiés au cycle suivant.
const resync = new Set<string>();
// Les tracés de course vivent 15 min dans Redis ; un tracé inchangé y est réécrit toutes les 5 min,
// ce qui laisse la marge de plusieurs cycles manqués avant son expiration.
const journeyPaths = createJourneyPathPublisher(900, 300_000);
const redis = createRedisClient({
	onReconnect: () => {
		journeyPaths.reset();
		for (const source of configuration.sources) resync.add(source.id);
	},
});
await redis.connect();
console.log("%s ► Connected! Journeys will be published into '%s'.", Temporal.Now.instant(), VEHICLE_JOURNEYS_CHANNEL);
console.log();

new Cron("0 0 0 * * *", () => {
	console.log("%s ► Computing journeys for the next day.", Temporal.Now.instant());
	for (const source of configuration.sources) source.computeNextJourneys();
	console.log();
	global.gc?.();
});

setInterval(() => global.gc?.(), GC_INTERVAL_MS);

serveStopDepartures(redis, configuration.id, configuration.sources).catch((error) => {
	// Les prochains passages sont un service d'appoint : leur indisponibilité ne doit pas empêcher
	// la publication des courses.
	console.error("✘ Failed to serve stop departures requests:", error);
	captureException(error);
});

const resourceLimit = pLimit(RESOURCE_IMPORT_CONCURRENCY);
const updateLimit = pLimit(1);
const computeLimit = pLimit(configuration.computeConcurrency ?? 6);

await Promise.all(
	configuration.sources.map((source) =>
		runSourceLoop(source, {
			providerId: configuration.id,
			sources: configuration.sources,
			redis,
			computeDelayMs: configuration.computeDelayMs,
			sourceBudgetMs: configuration.computeTimeoutMs ?? DEFAULT_SOURCE_COMPUTE_BUDGET_MS,
			computeLimit,
			resourceLimit,
			updateLimit,
			journeyPaths,
			resync,
			onStuck: (stuckSource) => void restartOnStuckSource(stuckSource),
		}),
	),
);

async function restartOnStuckSource(source: Source) {
	console.error("%s ✘ Source iteration is stuck, restarting processor.", source.logId);
	captureException(new Error(`Stuck iteration for source '${source.id}'`));
	await shutdownMonitoring();
	process.exit(1);
}
