import "dotenv";

import { setTimeout } from "node:timers/promises";
import { captureException, initMonitoring, shutdownMonitoring } from "@bus-tracker/monitoring";
import { createRedisClient } from "@bus-tracker/redis";
import { Cron } from "croner";
import DraftLog from "draftlog";
import pLimit from "p-limit";

import { loadConfiguration } from "./configuration/load-configuration.js";
import { computeVehicleJourneys } from "./jobs/compute-current-journeys.js";
import { computeNextJourneys } from "./jobs/compute-next-journeys.js";
import { initializeResources } from "./jobs/initialize-resources.js";
import { publishDataSourceManifests } from "./jobs/publish-data-sources.js";
import { sweepJourneys } from "./jobs/sweep-journeys.js";
import { updateResources } from "./jobs/update-resources.js";
import { configurationPath } from "./options.js";
import { createStopWatch } from "./utils/stop-watch.js";

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
let needsResync = false;
const redis = createRedisClient({
	onReconnect: () => {
		needsResync = true;
	},
});
const channel = process.env.REDIS_CHANNEL ?? "journeys";
const linePathTtlSeconds = 172_800;
await redis.connect();
console.log("%s ► Connected! Journeys will be published into '%s'.", Temporal.Now.instant(), channel);
console.log();

new Cron("0 0 0 * * *", () => computeNextJourneys(configuration.sources));

let lastUpdateAt = Date.now();
let lastSweepAt = Date.now();

await initializeResources(configuration.sources);
await publishLinePaths(configuration.sources);
await publishDataSourceManifests(redis, configuration.id, configuration.sources, { force: true });
while (true) {
	console.log("%s ► Entering loop cycle.", Temporal.Now.instant());

	if (Date.now() - lastUpdateAt > 600_000) {
		const updatedSources = await updateResources(configuration.sources);
		if (redis.isReady) {
			await publishLinePaths(updatedSources);
			await publishDataSourceManifests(redis, configuration.id, configuration.sources, { force: true });
		} else {
			// Les tracés des sources mises à jour seront republiés au retour de Redis.
			needsResync = true;
		}
		lastUpdateAt = Date.now();
	}

	if (Date.now() - lastSweepAt > 300_000) {
		sweepJourneys(configuration.sources);
		lastSweepAt = Date.now();
	}

	// Inutile de calculer des courses qui ne pourraient pas être publiées.
	if (!redis.isReady) {
		console.warn("%s ✘ Redis is unavailable, skipping computation.", Temporal.Now.instant());
		await setTimeout(configuration.computeDelayMs);
		continue;
	}

	if (needsResync) {
		needsResync = false;
		await publishLinePaths(configuration.sources);
		await publishDataSourceManifests(redis, configuration.id, configuration.sources, { force: true });
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
			captureException(new Error("Timeout computing journeys"));
			await shutdownMonitoring();
			process.exit(1);
		}
	} catch (e) {
		console.error("Failed to compute current journeys", e);
		captureException(e);
	}
	const computeDuration = Date.now() - startedAt;

	await publishDataSourceManifests(redis, configuration.id, configuration.sources);

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
					if (source.gtfs === undefined) return 0;
					const { journeys, paths } = await computeVehicleJourneys(source);

					for (const journey of journeys) {
						source.observedNetworkRefs.add(journey.networkRef);
					}

					for (let i = 0; i < journeys.length; i += 500) {
						const chunk = journeys.slice(i, Math.min(i + 500, journeys.length));
						await redis.publish(channel, JSON.stringify(chunk));
					}

					for (const [ref, path] of Object.entries(paths)) {
						await redis.set(ref, JSON.stringify(path), { EX: 900 });
					}

					await refreshLinePathTtls(source);

					return journeys.length;
				}),
			),
		);

		let computedJourneyCount = 0;
		for (const computationResult of computationResults) {
			if (computationResult.status === "rejected") {
				console.error(computationResult.reason);
				captureException(computationResult.reason);
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
		captureException(e);
	}

	console.log();
}

async function publishLinePaths(sources: typeof configuration.sources) {
	try {
		for (const source of sources) {
			for (const [ref, path] of source.linePaths) {
				await redis.set(ref, JSON.stringify(path), { EX: linePathTtlSeconds });
			}
		}
	} catch (e) {
		console.error("Failed to publish line paths", e);
		captureException(e);
		needsResync = true;
	}
}

async function refreshLinePathTtls(source: (typeof configuration.sources)[number]) {
	if (source.linePaths.size === 0) return;

	await Promise.all(Array.from(source.linePaths.keys(), (ref) => redis.expire(ref, linePathTtlSeconds)));
}
