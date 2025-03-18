import "dotenv/config.js";
import "./sentry.js";

import type { VehicleJourney } from "@bus-tracker/contracts";
import { serve } from "@hono/node-server";
import * as Sentry from "@sentry/node";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createClient } from "redis";

import { registerAnnouncementRoutes } from "./controllers/announcements.js";
import { registerGirouetteRoutes } from "./controllers/girouettes.js";
import { registerLineRoutes } from "./controllers/lines.js";
import { registerNetworkRoutes } from "./controllers/networks.js";
import { registerVehicleJourneyRoutes } from "./controllers/vehicle-journeys.js";
import { registerVehicleRoutes } from "./controllers/vehicles.js";
import { migrateDatabase } from "./database/migrate.js";
import { handleVehicleBatch } from "./jobs/handle-vehicle-batch.js";
import { port } from "./options.js";
import { createJourneyStore } from "./store/journey-store.js";

console.log(`,-----.                  ,--------.                   ,--.                           ,---.                                       
|  |) /_ ,--.,--. ,---.  '--.  .--',--.--.,--,--.,---.|  |,-. ,---. ,--.--. ,-----. '   .-' ,---. ,--.--.,--.  ,--.,---. ,--.--. 
|  .-.  \\|  ||  |(  .-'     |  |   |  .--' ,-.  | .--'|     /| .-. :|  .--' '-----' \`.  \`-.| .-. :|  .--' \\  \`'  /| .-. :|  .--' 
|  '--' /'  ''  '.-'  \`)    |  |   |  |  \\ '-'  \\ \`--.|  \\  \\   --.|   |            .-'    \\   --.|  |     \\    / \\   --.|  |    
\`------'  \`----' \`----'     \`--'   \`--'   \`--\`--'\`---'\`--'\`--'\`----'\`--'            \`-----' \`----'\`--'      \`--'   \`----'\`--'    \n`);

const journeyStore = createJourneyStore();

console.log("► Running database migrations.");
await migrateDatabase();

console.log("► Connecting to Redis.");
const redis = createClient({ url: process.env.REDIS_URL ?? "redis://localhost:6379" });
await redis.connect();

await redis.subscribe("journeys", async (message) => {
	let vehicleJourneys: VehicleJourney[];

	try {
		const payload = JSON.parse(message);
		if (!Array.isArray(payload)) throw new Error("Payload is not an array");
		vehicleJourneys = payload as VehicleJourney[];
		// vehicleJourneys = payload.flatMap((entry) => {
		// 	const parsed = vehicleJourneySchema.safeParse(entry);
		// 	if (!parsed.success) {
		// 		Sentry.captureException(parsed.error, { extra: { entry }, tags: { section: "journey-decode" } });
		// 		return [];
		// 	}
		// 	return parsed.data;
		// });
	} catch (error) {
		Sentry.captureException(error, {
			extra: { message },
			tags: { section: "journey-decode" },
		});
		console.error(error);
		return;
	}

	await handleVehicleBatch(journeyStore, vehicleJourneys);
});

console.log("► Listening on port %d.\n", port);

export const hono = new Hono();
hono.use(cors({ origin: "*" }));
registerAnnouncementRoutes(hono);
registerLineRoutes(hono);
registerNetworkRoutes(hono, journeyStore);
registerVehicleRoutes(hono, journeyStore);
registerVehicleJourneyRoutes(hono, journeyStore);
registerGirouetteRoutes(hono);
serve({ fetch: hono.fetch, port });
