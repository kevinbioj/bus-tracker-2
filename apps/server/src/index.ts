import "dotenv";
import "./sentry.js";

import { serve } from "@hono/node-server";
import * as Sentry from "@sentry/node";
import { Hono } from "hono";
import { compress } from "hono/compress";
import { createClient } from "redis";
import { Temporal } from "temporal-polyfill";

import { type VehicleJourney, vehicleJourneySchema } from "@bus-tracker/contracts";

import { cors } from "hono/cors";
import { registerNetworkRoutes } from "./controllers/networks.js";
import { registerVehicleJourneyRoutes } from "./controllers/vehicle-journeys.js";
import { registerVehicleRoutes } from "./controllers/vehicles.js";
import { registerActivity } from "./functions/register-activity.js";
import { createJourneyStore } from "./store/journey-store.js";

console.log(`,-----.                  ,--------.                   ,--.                           ,---.                                       
|  |) /_ ,--.,--. ,---.  '--.  .--',--.--.,--,--.,---.|  |,-. ,---. ,--.--. ,-----. '   .-' ,---. ,--.--.,--.  ,--.,---. ,--.--. 
|  .-.  \\|  ||  |(  .-'     |  |   |  .--' ,-.  | .--'|     /| .-. :|  .--' '-----' \`.  \`-.| .-. :|  .--' \\  \`'  /| .-. :|  .--' 
|  '--' /'  ''  '.-'  \`)    |  |   |  |  \\ '-'  \\ \`--.|  \\  \\   --.|   |            .-'    \\   --.|  |     \\    / \\   --.|  |    
\`------'  \`----' \`----'     \`--'   \`--'   \`--\`--'\`---'\`--'\`--'\`----'\`--'            \`-----' \`----'\`--'      \`--'   \`----'\`--'    \n`);

const journeyStore = createJourneyStore();

console.log("► Connecting to Redis.");
const redis = createClient({ url: process.env.REDIS_URL });
await redis.connect();

redis.subscribe("journeys", async (message) => {
	let vehicleJourney: VehicleJourney;

	try {
		const payload = JSON.parse(message);
		vehicleJourney = vehicleJourneySchema.parse(payload);
	} catch (error) {
		Sentry.captureException(error, {
			extra: { message },
			tags: { section: "journey-decode" },
		});
		return;
	}

	const timeSince = Temporal.Now.instant().since(vehicleJourney.updatedAt);
	if (timeSince.total("minutes") >= 10) return;

	registerActivity(vehicleJourney);
	journeyStore.set(vehicleJourney.id, vehicleJourney);
});

const port = +(process.env.PORT ?? 8080);
console.log("► Listening on port %d.\n", port);

export const hono = new Hono();
hono.use(compress());
hono.use(cors({ origin: "*" }));
registerNetworkRoutes(hono);
registerVehicleRoutes(hono);
registerVehicleJourneyRoutes(hono, journeyStore);
serve({ fetch: hono.fetch, port });
