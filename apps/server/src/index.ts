import { createClient } from "redis";

import { migrateDatabase } from "./core/database/migrate.js";
import { journeyStore } from "./core/store/journey-store.js";
import { port } from "./options.js";
import { hono } from "./server.js";
import type { DisposeableVehicleJourney } from "./types/disposeable-vehicle-journey.js";

import "./controllers/announcements.js";
import "./controllers/editors.js";
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

let worker: Worker;

function startVehicleWorker() {
	console.log("► Starting vehicle worker.");
	worker = new Worker(new URL("./vehicle-handling/vehicle-worker.ts", import.meta.url).href, {
		type: "module",
	});

	worker.onmessage = (event: MessageEvent<DisposeableVehicleJourney[]>) => {
		for (const journey of event.data) {
			journeyStore.set(journey.id, journey);
		}
	};

	worker.onerror = (event) => {
		console.error("✘ Worker has encountered an error:", event.message);
		console.warn("⚠ Worker crashed! Restarting in 5 seconds.");
		setTimeout(() => {
			worker.terminate();
			worker = startVehicleWorker();
		}, 5000);
	};

	return worker;
}

startVehicleWorker();

console.log("► Connecting to Redis.");
export const redis = createClient({
	url: process.env.REDIS_URL ?? "redis://localhost:6379",
});
await redis.connect();

console.log("► Listening on port %d.\n", port);
export default {
	fetch: hono.fetch,
	port,
};
