import { Worker } from "node:worker_threads";
import { DATA_SOURCES_CHANNEL } from "@bus-tracker/contracts";
import { serve } from "@hono/node-server";
import { createClient } from "redis";

import { migrateDatabase } from "./core/database/migrate.js";
import { parseDataSourceManifests, upsertDataSources } from "./core/services/data-source-service.js";
import {
	startVehicleReportCleanupService,
	sweepExpiredVehicleReports,
} from "./core/services/vehicle-report-cleanup-service.js";
import { journeyStore } from "./core/store/journey-store.js";
import { port } from "./options.js";
import { hono } from "./server.js";
import type { DisposeableVehicleJourney } from "./types/disposeable-vehicle-journey.js";

import "./controllers/announcements.js";
import "./controllers/data-sources.js";
import "./controllers/editors.js";
import "./controllers/girouettes.js";
import "./controllers/lines.js";
import "./controllers/networks.js";
import "./controllers/ping.js";
import "./controllers/regions.js";
import "./controllers/vehicle-journeys.js";
import "./controllers/vehicles.js";

console.log(`,-----.                  ,--------.                   ,--.                           ,---.                                       
|  |) /_ ,--.,--. ,---.  '--.  .--',--.--.,--,--.,---.|  |,-. ,---. ,--.--. ,-----. '   .-' ,---. ,--.--.,--.  ,--.,---. ,--.--. 
|  .-.  \\|  ||  |(  .-'     |  |   |  .--' ,-.  | .--'|     /| .-. :|  .--' '-----' \`.  \`-.| .-. :|  .--' \\  \`'  /| .-. :|  .--' 
|  '--' /'  ''  '.-'  \`)    |  |   |  |  \\ '-'  \\ \`--.|  \\  \\   --.|   |            .-'    \\   --.|  |     \\    / \\   --.|  |    
\`------'  \`----' \`----'     \`--'   \`--'   \`--\`--'\`---'\`--'\`--'\`----'\`--'            \`-----' \`----'\`--'      \`--'   \`----'\`--'    \n`);

console.log("► Running database migrations.");
await migrateDatabase();
await sweepExpiredVehicleReports();
startVehicleReportCleanupService();

let worker: Worker;

function startVehicleWorker() {
	console.log("► Starting vehicle worker.");

	const workerPath = new URL("./vehicle-handling/vehicle-worker.js", import.meta.url);
	worker = new Worker(workerPath);
	worker.on("message", (data: DisposeableVehicleJourney[]) => {
		for (const journey of data) {
			journeyStore.set(journey.id, journey);
		}
	});

	worker.on("error", (error) => {
		console.error("✘ Worker has encountered an error:", error instanceof Error ? error.stack : error);
		console.warn("⚠ Worker crashed! Restarting in 5 seconds.");
		setTimeout(() => {
			worker.terminate();
			worker = startVehicleWorker();
		}, 5000);
	});

	return worker;
}

startVehicleWorker();

console.log("► Connecting to Redis.");
export const redis = createClient({
	socket: process.env.REDIS_SOCK
		? {
				path: process.env.REDIS_SOCK,
				tls: process.env.REDIS_TLS === "true",
			}
		: undefined,
	url: process.env.REDIS_SOCK ? undefined : process.env.REDIS_URL,
});
await redis.connect();

redis.on("error", (error) => {
	console.error("✘ An error occurred with Redis:", error);
});

// Les providers annoncent périodiquement les flux qu'ils consomment : on les persiste pour la
// page d'attributions. Le volume est marginal, inutile de passer par le worker véhicules.
const dataSourcesSubscriber = redis.duplicate();

dataSourcesSubscriber.on("error", (error) => {
	console.error("✘ An error occurred with Redis data sources subscriber:", error);
});

await dataSourcesSubscriber.connect();
await dataSourcesSubscriber.subscribe(DATA_SOURCES_CHANNEL, (message) => {
	try {
		const manifests = parseDataSourceManifests(JSON.parse(message));
		if (manifests.length === 0) return;
		void upsertDataSources(manifests).catch((error) => {
			console.error("✘ Failed to persist data sources:", error);
		});
	} catch (error) {
		console.error("✘ Failed to handle a data sources message:", error);
	}
});
console.log("► Subscribed to the data sources channel.");

console.log("► Listening on port %d.\n", port);
serve({
	fetch: hono.fetch,
	port,
});
