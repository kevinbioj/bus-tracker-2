import type { VehicleJourney, VehicleJourneyLineType } from "@bus-tracker/contracts";
import DraftLog from "draftlog";
import { createClient } from "redis";
import { Temporal } from "temporal-polyfill";

import { getLines, getVehicles } from "./data.js";

DraftLog(console, !process.stdout.isTTY)?.addLineListener(process.stdin);

console.log("%s ► Connecting to Redis.", Temporal.Now.instant());
const redis = createClient({
	url: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
	username: process.env.REDIS_USERNAME,
	password: process.env.REDIS_PASSWORD,
});
const channel = process.env.REDIS_CHANNEL ?? "journeys";
await redis.connect();
console.log("%s ► Connected! Journeys will be published into '%s'.", Temporal.Now.instant(), channel);
console.log();

const lines = await getLines();

async function mainLoop() {
	const updateLog = console.draft("%s ► Fetching vehicles...", Temporal.Now.instant());

	const { recordedAt, vehicles } = await getVehicles();

	const vehicleJourneys: VehicleJourney[] = vehicles.map((vehicle) => {
		const lineRef = vehicle.Line.replace("RTM:LNE:", "");
		const vehicleRef = +vehicle.Id.replace("RTM:VEH:05", "");

		const line = lines.find((l) => l.LineId === vehicle.Line);

		// Culot complet
		const destination = line?.LineName.split(" - ")[+vehicle.Direction - 1];

		return {
			id: `RTM::VehicleTracking:${vehicleRef}`,
			line: {
				ref: `RTM:Line:${lineRef}`,
				number: line?.LineNumber ?? "?",
				type: (line?.Mode.toUpperCase() ?? "UNKNOWN") as VehicleJourneyLineType,
				color: line?.Color.slice(1),
				textColor: "FFFFFF",
			},
			direction: vehicle.Direction === "1" ? "OUTBOUND" : "INBOUND",
			destination,
			position: {
				latitude: vehicle.Latitude,
				longitude: vehicle.Longitude,
				atStop: false,
				type: "GPS",
				recordedAt: recordedAt.toString({ timeZoneName: "never" }),
			},
			networkRef: "RTM",
			vehicleRef: `RTM::Vehicle:${vehicleRef}`,
			updatedAt: recordedAt.toInstant().toString(),
		};
	});

	await redis.publish(channel, JSON.stringify(vehicleJourneys));
	updateLog(`%s ► ${vehicleJourneys.length} vehicles have been fetched!`, Temporal.Now.instant());
}

mainLoop();
setInterval(mainLoop, 30_000);
