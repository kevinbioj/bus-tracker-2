import "dotenv";
import "./sentry.js";

import { serve } from "@hono/node-server";
import * as Sentry from "@sentry/node";
import { Hono } from "hono";
import { compress } from "hono/compress";
import { createClient } from "redis";
import * as z from "zod";

import { type VehicleJourney, vehicleJourneySchema } from "@bus-tracker/contracts";

import { cors } from "hono/cors";
import { registerNetworkRoutes } from "./controllers/networks.js";
import { registerVehicleJourneyRoutes } from "./controllers/vehicle-journeys.js";
import { registerVehicleRoutes } from "./controllers/vehicles.js";
import { handleVehicleBatch } from "./jobs/handle-vehicle-batch.js";
import { port } from "./options.js";
import { createJourneyStore } from "./store/journey-store.js";

console.log(`,-----.                  ,--------.                   ,--.                           ,---.                                       
|  |) /_ ,--.,--. ,---.  '--.  .--',--.--.,--,--.,---.|  |,-. ,---. ,--.--. ,-----. '   .-' ,---. ,--.--.,--.  ,--.,---. ,--.--. 
|  .-.  \\|  ||  |(  .-'     |  |   |  .--' ,-.  | .--'|     /| .-. :|  .--' '-----' \`.  \`-.| .-. :|  .--' \\  \`'  /| .-. :|  .--' 
|  '--' /'  ''  '.-'  \`)    |  |   |  |  \\ '-'  \\ \`--.|  \\  \\   --.|   |            .-'    \\   --.|  |     \\    / \\   --.|  |    
\`------'  \`----' \`----'     \`--'   \`--'   \`--\`--'\`---'\`--'\`--'\`----'\`--'            \`-----' \`----'\`--'      \`--'   \`----'\`--'    \n`);

const journeyStore = createJourneyStore();

console.log("► Connecting to Redis.");
const redis = createClient({ url: process.env.REDIS_URL ?? "redis://localhost:6379" });
await redis.connect();

await redis.subscribe("journeys", async (message) => {
	let vehicleJourneys: VehicleJourney[];

	try {
		const payload = JSON.parse(message);
		vehicleJourneys = z.array(vehicleJourneySchema).parse(payload);
	} catch (error) {
		Sentry.captureException(error, {
			extra: { message },
			tags: { section: "journey-decode" },
		});
		console.error(error);
		return;
	}

	for (const vehicleJourney of vehicleJourneys) {
		journeyStore.set(vehicleJourney.id, vehicleJourney);
	}
	await handleVehicleBatch(vehicleJourneys);
});

console.log("► Listening on port %d.\n", port);

export const hono = new Hono();
hono.use(compress());
hono.use(cors({ origin: "*" }));
registerNetworkRoutes(hono);
registerVehicleRoutes(hono);
registerVehicleJourneyRoutes(hono, journeyStore);
serve({ fetch: hono.fetch, port });
