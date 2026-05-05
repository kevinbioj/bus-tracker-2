import { setTimeout } from "node:timers/promises";
import type { VehicleJourney } from "@bus-tracker/contracts";
import { initMonitoring } from "@bus-tracker/monitoring";
import { createClient } from "redis";
import { match, P } from "ts-pattern";

import { REFRESH_INTERVAL } from "./config.js";
import { getLines, getVehicles, type Line } from "./data.js";

initMonitoring("processor-rtm");

console.log("► Connecting to Redis.");
const redis = createClient({
	socket: process.env.REDIS_SOCK
		? {
				path: process.env.REDIS_SOCK,
				tls: process.env.REDIS_TLS === "true",
			}
		: undefined,
	url: process.env.REDIS_SOCK ? undefined : (process.env.REDIS_URL ?? "redis://127.0.0.1:6379"),
});
const channel = process.env.REDIS_CHANNEL ?? "journeys";
await redis.connect();
console.log(`► Connected! Journeys will be published into '${channel}'.`);
console.log();

let lines: Line[] = [];
let linesUpdatedAt: number | undefined;

while (true) {
	const then = Date.now();

	if (linesUpdatedAt === undefined || then - linesUpdatedAt > 3_600_000) {
		console.log("► Updating lines list.");

		try {
			lines = await getLines();
			linesUpdatedAt = Date.now();

			const waitingTime = Math.max(10_000, REFRESH_INTERVAL / 2 - (Date.now() - then));
			console.log(`✓ Updated list with ${lines.length} lines! Waiting for ${waitingTime}ms.`);
			await setTimeout(waitingTime);
		} catch (e) {
			const waitingTime = Math.max(10_000, REFRESH_INTERVAL / 2 - (Date.now() - then));
			console.error(`✘ Failed to update lines list! Waiting for ${waitingTime}ms.`, e);
			await setTimeout(waitingTime);
		}

		continue;
	}

	console.log("► Fetching vehicles list.");

	try {
		const { recordedAt, vehicles } = await getVehicles(lines.map(({ LineId }) => LineId));

		const vehicleJourneys: VehicleJourney[] = vehicles.map((vehicle) => {
			const lineRef = vehicle.Line.split(":")[2];
			const [operatorRef, , vehicleRef] = vehicle.Id.split(":");

			const line = lines.find((l) => l.LineId === vehicle.Line);

			// Culot complet
			const destination = line?.LineName.split(" - ")[vehicle.Direction === "1" ? 1 : 0];

			return {
				id: `RTM:${operatorRef}:VehicleTracking:${vehicleRef}`,
				line: {
					ref: `RTM:Line:${lineRef}`,
					number: line?.LineNumber ?? "?",
					type: match(line?.Color)
						.with("Metro", () => "SUBWAY" as const)
						.with("Tramway", () => "TRAMWAY" as const)
						.with(P.union("Bus", "DayEveningBus", "SchoolBus", "NightBus"), () => "BUS" as const)
						.with("Ferry", () => "FERRY" as const)
						.otherwise(() => "UNKNOWN" as const),
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
				operatorRef,
				vehicleRef: `RTM:${operatorRef}:Vehicle:${+vehicleRef!.slice(3)}`,
				updatedAt: recordedAt.toInstant().toString(),
			};
		});

		await redis.publish(channel, JSON.stringify(vehicleJourneys));

		const waitingTime = Math.max(10_000, REFRESH_INTERVAL - (Date.now() - then));
		console.log(
			`✓ Published ${vehicleJourneys.length} vehicles in ${Date.now() - then}ms! Waiting for ${waitingTime}ms.`,
		);
		await setTimeout(waitingTime);
	} catch (e) {
		const waitingTime = Math.max(10_000, REFRESH_INTERVAL - (Date.now() - then));
		console.error(`✘ Failed to fetch vehicles! Waiting for ${waitingTime}ms.`, e);
		await setTimeout(waitingTime);
	}
}
