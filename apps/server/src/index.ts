import "dotenv/config.js";
import "./sentry.js";

import { type VehicleJourney, vehicleJourneySchema } from "@bus-tracker/contracts";
import { serve } from "@hono/node-server";
import * as Sentry from "@sentry/node";
import { createClient } from "redis";

import { hono } from "./server.js";
import api from "./api/index.js";
import { migrateDatabase } from "./database/migrate.js";
import { handleVehicleBatch } from "./jobs/handle-vehicle-batch.js";
import { port } from "./options.js";

import "./controllers/announcements.js";
import "./controllers/editors.js";
import "./controllers/lines.js";
import "./controllers/networks.js";
import "./controllers/regions.js";
import "./controllers/vehicle-journeys.js";
import "./controllers/vehicles.js";

hono.route("/v2", api);

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

await redis.subscribe("journeys", async (message) => {
	let vehicleJourneys: VehicleJourney[];

	try {
		const payload = JSON.parse(message);
		if (!Array.isArray(payload)) throw new Error("Payload is not an array");
		vehicleJourneys = payload.flatMap((entry) => {
			const parsed = vehicleJourneySchema.safeParse(entry);
			if (!parsed.success) {
				Sentry.captureException(parsed.error, {
					extra: { entry },
					tags: { section: "journey-decode" },
				});
				return [];
			}
			return parsed.data;
		});
	} catch (error) {
		Sentry.captureException(error, {
			extra: { message },
			tags: { section: "journey-decode" },
		});
		console.error(error);
		return;
	}

	await handleVehicleBatch(vehicleJourneys);
});

console.log("► Listening on port %d.\n", port);
serve({ fetch: hono.fetch, port });
