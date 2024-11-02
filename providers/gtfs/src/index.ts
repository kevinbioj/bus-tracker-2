import { Cron } from "croner";
import DraftLog from "draftlog";
import pLimit from "p-limit";
import { createClient } from "redis";
import { Temporal } from "temporal-polyfill";

import { loadConfiguration } from "./configuration/load-configuration.js";
import { computeVehicleJourneys } from "./jobs/compute-vehicle-journeys.js";
import { loadGtfs } from "./jobs/load-gtfs.js";
import { sweepJourneys } from "./jobs/sweep-vehicle-journeys.js";
import { updateGtfs } from "./jobs/update-gtfs.js";
import type { Source } from "./model/source.js";
import { padSourceId } from "./utils/pad-source-id.js";
import { createStopWatch } from "./utils/stop-watch.js";

DraftLog(console, !process.stdout.isTTY)?.addLineListener(process.stdin);

const now = () => {
	const now = Temporal.Now.zonedDateTimeISO();
	return `${now.toPlainDate()}T${now.toPlainTime().toString({ smallestUnit: "second" })}`;
};

const configurationPath = process.argv[2] ?? process.env.CONFIGURATION_PATH;
if (typeof configurationPath !== "string") {
	console.error("Usage: gtfs-processor [configuration path]");
	console.error('Note: if no argument is given, environment variable "CONFIGURATION_PATH" will be used.');
	process.exit(1);
}

console.log(` ,----.,--------.,------.,---.   ,------.                                                         
'  .-./'--.  .--'|  .---'   .-'  |  .--. ',--.--. ,---.  ,---. ,---.  ,---.  ,---.  ,---. ,--.--. 
|  | .---.|  |   |  \`--,\`.  \`-.  |  '--' ||  .--'| .-. || .--'| .-. :(  .-' (  .-' | .-. ||  .--' 
'  '--'  ||  |   |  |\`  .-'    | |  | --' |  |   ' '-' '  \`--.    --..-'  \`).-'  \`)' '-' '|  |    
 \`------' \`--'   \`--'   \`-----'  \`--'     \`--'    \`---'  \`---' \`----'\`----' \`----'  \`---' \`--'    \n\n`);

const configuration = await loadConfiguration(configurationPath);

console.log("%s ► Connecting to Redis.", now());
const redis = createClient(configuration.redisOptions);
const channel = process.env.REDIS_CHANNEL ?? "journeys";
await redis.connect();

const initLimit = 4;
const initLimitFn = pLimit(initLimit);
const initWatch = createStopWatch();
console.log("%s ► Loading resources (concurrency limit: %d).", now(), initLimit);
const results = await Promise.allSettled(configuration.sources.map((source) => initLimitFn(() => loadGtfs(source))));
for (const result of results) {
	if (result.status !== "rejected") continue;
	console.log();
	console.error(result.reason);
	console.log();
}
console.log("✓ Load complete in %dms.\n", initWatch.total());

// C'est moche mais je n'ai pas le temps de l'attendre moi-même...
global.gc?.({ execution: "sync", flavor: "last-resort", type: "major" });
console.log("► Initialization is complete.\n");

setInterval(
	async () => {
		console.log("%s ► Checking resources staleness.", now());
		for (const source of configuration.sources) {
			try {
				await updateGtfs(source);
			} catch (e) {
				console.log();
				console.error(e);
				console.log();
			}
		}
		console.log();
		global.gc?.();
	},
	Temporal.Duration.from({ minutes: 5 }).total("milliseconds"),
);

// ---

setInterval(
	() => {
		console.log("%s ► Sweeping outdated journey entries.", now());
		configuration.sources.forEach(sweepJourneys);
		console.log();
		global.gc?.();
	},
	Temporal.Duration.from({ hours: 1 }).total("milliseconds"),
);

// ---

new Cron("0 0 0 * * *", () => {
	console.log("%s ► Computing journeys for the next day.", now());
	for (const source of configuration.sources) {
		const sourceId = padSourceId(source);
		if (typeof source.gtfs === "undefined") {
			console.warn("%s ⚠ Source has no loaded GTFS data, ignoring.", sourceId);
			continue;
		}

		const date = Temporal.Now.plainDateISO();

		const updateLog = console.draft("%s ► Computing journeys for date '%s'.", sourceId, date);
		const watch = createStopWatch();

		let computedJourneys = 0;
		for (const trip of source.gtfs.trips.values()) {
			const journey = trip.getScheduledJourney(date);
			if (typeof journey !== "undefined") {
				source.gtfs.journeys.push(journey);
				computedJourneys += 1;
			}
		}
		source.gtfs.journeys.sort((a, b) =>
			Temporal.ZonedDateTime.compare(a.calls.at(0)!.aimedArrivalTime, b.calls.at(0)!.aimedArrivalTime),
		);

		updateLog("%s ✓ Computed %d journeys for date '%s' in %dms.", sourceId, computedJourneys, date, watch.total());
	}
	console.log();
});

// ---

async function publishJourneysForSource(source: Source) {
	if (typeof source.gtfs === "undefined") return 0;

	const journeys = await computeVehicleJourneys(source);
	redis.publish(channel, JSON.stringify(journeys));

	return journeys.length;
}

async function computeAndPublish() {
	const watch = createStopWatch();

	const computeLimit = 6;
	const computeLimitFn = pLimit(computeLimit);
	const updateLog = console.draft("%s ► Computing vehicle journeys to publish.", now());

	try {
		const computationResults = await Promise.allSettled(
			configuration.sources.map((source) => computeLimitFn(() => publishJourneysForSource(source))),
		);

		let computedJourneyCount = 0;

		for (const computationResult of computationResults) {
			if (computationResult.status === "rejected") {
				console.error(computationResult.reason);
				continue;
			}
			computedJourneyCount += computationResult.value;
		}

		updateLog("%s ✓ Published %d vehicle journey entries in %dms.", now(), computedJourneyCount, watch.total());
	} catch (e) {
		updateLog("%s ✘ Something wrong occurred while publishing vehicle journeys.", now());
		console.error(e);
	}

	console.log();
	global.gc?.();
}

computeAndPublish();
setInterval(computeAndPublish, configuration.computeDelayMs);
