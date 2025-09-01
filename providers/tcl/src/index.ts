import { setTimeout } from "node:timers/promises";
import DraftLog from "draftlog";
import { createClient } from "redis";
import { Temporal } from "temporal-polyfill";

import { convertPosition } from "./convert-position.js";
import { getVehicles } from "./get-vehicles.js";
import type { TclGtfsRt } from "./types.js";

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

let currentIndex = 0;

while (true) {
	if (currentIndex >= lines.length) currentIndex = 0;

	const onlineGtfsRtVehicles: number[] = await fetch("https://gtfs.bus-tracker.fr/gtfs-rt/tcl?format=json")
		.then((response) => response.json() as Promise<TclGtfsRt>)
		.then((feed) =>
			feed.entity
				.filter(
					(entity) =>
						typeof entity.vehicle !== "undefined" && Math.floor(Date.now() / 1000) - entity.vehicle.timestamp < 600,
				)
				.map((entity) => +entity.vehicle!.vehicle.id),
		)
		.catch(() => []);

	const linesFilter = lines[currentIndex]!;
	const id = `[${linesFilter.map(({ line, direction }) => `(${line}:${direction})`).join(",")}]`;
	const updateLog = console.draft(`%s ► Fetching ${id}`, Temporal.Now.instant());

	try {
		const { Vehicules, Total, ping } = await getVehicles(
			linesFilter.map(({ line, direction }) => ({
				Ligne: line,
				Sens: direction as "ALL" | "RET",
			})),
		);

		const mappedVehicles = Vehicules.filter((vehicle) => !onlineGtfsRtVehicles.includes(vehicle.NumeroCarrosserie)).map(
			(vehicle) => ({
				id: `TCL::VehicleTracking:${vehicle.NumeroCarrosserie}`,
				line: {
					ref: `TCL:Line:${vehicle.Ligne}`,
					number: vehicle.Ligne,
					type: vehicle.Ligne.startsWith("T") ? "TRAMWAY" : "BUS",
				},
				direction: vehicle.Sens === "ALL" ? "OUTBOUND" : "INBOUND",
				destination: vehicle.Destination,
				position: {
					...convertPosition({ X: vehicle.X, Y: vehicle.Y }),
					atStop: false,
					type: "GPS",
					recordedAt: Temporal.Now.zonedDateTimeISO().toString({
						timeZoneName: "never",
					}),
				},
				networkRef: "TCL",
				vehicleRef: `TCL::Vehicle:${vehicle.NumeroCarrosserie}`,
				updatedAt: Temporal.Now.instant().toString(),
			}),
		);

		await redis.publish(channel, JSON.stringify(mappedVehicles));

		const success =
			Total > Vehicules.length
				? `${Temporal.Now.instant()} ✓ Processed ${Vehicules.length} vehicles for ${id} (${Total - Vehicules.length} were missed) (ping: ${ping}ms)`
				: `${Temporal.Now.instant()} ✓ Processed ${Vehicules.length} vehicles for ${id} (ping: ${ping}ms)`;

		updateLog(success);
		currentIndex += 1;
	} catch (cause) {
		const error = new Error("An error occurred while fetching data", { cause });
		console.error(error);
	} finally {
		await setTimeout(1000);
	}
}
