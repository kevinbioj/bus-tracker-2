import "dotenv/config.js";

import { type VehicleJourney, type VehicleJourneyPath, vehicleJourneySchema } from "@bus-tracker/contracts";
import { serve } from "@hono/node-server";
import { createClient } from "redis";

import { migrateDatabase } from "./core/database/migrate.js";
import { pathStore } from "./core/store/path-store.js";
import { handleVehicleBatch } from "./vehicle-handling/handle-vehicle-batch.js";

import { port } from "./options.js";
import { hono } from "./server.js";

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

console.log("► Connecting to Redis.");
const redis = createClient({
	url: process.env.REDIS_URL ?? "redis://localhost:6379",
});
await redis.connect();

await redis.subscribe("paths", (message) => {
	try {
		const paths = JSON.parse(message) as Record<string, VehicleJourneyPath>;
		for (const [ref, path] of Object.entries(paths)) {
			if (!pathStore.has(ref)) {
				pathStore.set(ref, path);
			}
		}
	} catch (error) {
		console.error("Failed to parse paths:", error);
	}
});

await redis.subscribe("journeys", async (message) => {
	let didWarn = false;
	let vehicleJourneys: VehicleJourney[];

	try {
		const payload = JSON.parse(message);
		if (!Array.isArray(payload)) throw new Error("Payload is not an array");
		vehicleJourneys = payload.flatMap((entry) => {
			const parsed = vehicleJourneySchema.safeParse(entry);
			if (!parsed.success) {
				if (!didWarn) {
					console.warn(`Rejected object(s) from journeys channel, sample:`, entry);
					console.error(parsed.error);
					didWarn = true;
				}
				return [];
			}
			if (parsed.data.path !== undefined) {
				console.log("► Received journey with path:", parsed.data.id);
			}
			return parsed.data;
		});
	} catch (error) {
		console.error(error);
		return;
	}

	await handleVehicleBatch(vehicleJourneys);
});

console.log("► Listening on port %d.\n", port);
serve({ fetch: hono.fetch, port });
