import { setTimeout } from "node:timers/promises";
import DraftLog from "draftlog";
import { createClient } from "redis";
import { Temporal } from "temporal-polyfill";

import { convertPosition } from "./convert-position.js";
import { getVehicles } from "./get-vehicles.js";

import lines from "../data/lines.json" with { type: "json" };

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

const listIterable = lines.flatMap((line) => [
	{ line, direction: "ALL" as const },
	{ line, direction: "RET" as const },
]);
let currentIndex = 0;

while (true) {
	if (currentIndex >= listIterable.length) currentIndex = 0;

	const { line, direction } = listIterable[currentIndex]!;
	const updateLog = console.draft(`%s ► Fetching line ${line} in direction ${direction}`, Temporal.Now.instant());

	const { Vehicules, Total } = await getVehicles(line, direction);

	const mappedVehicles = Vehicules.map((vehicle) => ({
		id: `TCL::VehicleTracking:${vehicle.NumeroCarrosserie}`,
		line: {
			ref: `TCL:Line:${vehicle.Ligne}`,
			number: vehicle.Ligne,
			type: vehicle.Ligne.startsWith("T") ? "TRAMWAY" : "BUS",
		},
		direction: direction === "ALL" ? "OUTBOUND" : "INBOUND",
		destination: vehicle.Destination,
		position: {
			...convertPosition({ X: vehicle.X, Y: vehicle.Y }),
			atStop: false,
			type: "GPS",
			recordedAt: Temporal.Now.zonedDateTimeISO().toString({ timeZoneName: "never" }),
		},
		networkRef: "TCL",
		vehicleRef: `TCL::Vehicle:${vehicle.NumeroCarrosserie}`,
		updatedAt: Temporal.Now.instant().toString(),
	}));

	await redis.publish(channel, JSON.stringify(mappedVehicles));

	const success =
		Total > Vehicules.length
			? `${Temporal.Now.instant()} ✓ Processed ${Vehicules.length} vehicles on line ${line} direction ${direction} (${Total - Vehicules.length} were missed)`
			: `${Temporal.Now.instant()} ✓ Processed ${Vehicules.length} vehicles on line ${line} direction ${direction}`;

	updateLog(success);
	currentIndex += 1;
	await setTimeout(500);
}
