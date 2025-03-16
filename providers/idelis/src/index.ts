import { setTimeout } from "node:timers/promises";
import type { VehicleJourney } from "@bus-tracker/contracts";
import DraftLog from "draftlog";
import { createClient } from "redis";
import { Temporal } from "temporal-polyfill";

import { fetchVehicles } from "./fetch-vehicles.js";
import { lines } from "./lines.js";

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

for (const line of lines) {
	const updateLog = console.draft(`%s ► Fetching vehicles for line '${line.id}'...`, Temporal.Now.instant());

	const vehicles = await fetchVehicles(line.id);

	const vehicleJourneys = vehicles.flatMap((vehicle) => {
		if (vehicle.latitude === "" || vehicle.longitude === "" || vehicle.Delay === "") return [];

		const recordedAt = Temporal.PlainDateTime.from(vehicle.RecordedAtTime).toZonedDateTime("Europe/Paris");
		const stops = vehicle.ligne.shape.filter(({ type }) => type === "stop");
		const delay = Temporal.Duration.from(vehicle.Delay);

		return {
			id: `IDELIS::VehicleTracking:${vehicle.vehicle}`,
			line: {
				ref: `IDELIS:Line:${line.id}`,
				number: line.name,
				type: "BUS",
				color: line.color,
				textColor: line.textColor,
			},
			direction: vehicle.ligne.direction === 0 ? "OUTBOUND" : "INBOUND",
			destination: stops.find(({ id }) => id === vehicle.ligne.arrivee)?.name,
			position: {
				latitude: +vehicle.latitude,
				longitude: +vehicle.longitude,
				atStop: false,
				type: "GPS",
				recordedAt: recordedAt.toString({ timeZoneName: "never" }),
			},
			calls: vehicle.journey.flatMap((call) => {
				const stopIndex = stops.findIndex(({ id }) => id === call.stop);
				if (stopIndex === -1) return [];

				const time = call.DepartureTime || call.ArrivalTime;
				if (typeof time === "undefined") return [];

				const expectedTime = Temporal.PlainDateTime.from(time).toZonedDateTime("Europe/Paris");

				const stop = stops.at(stopIndex)!;
				return {
					stopRef: stop.id,
					stopName: stop.name,
					stopOrder: stopIndex + 1,
					aimedTime: expectedTime.subtract(delay).toString({ timeZoneName: "never" }),
					expectedTime: expectedTime.toString({ timeZoneName: "never" }),
					callStatus: "SCHEDULED",
				};
			}),
			networkRef: "IDELIS",
			vehicleRef: `IDELIS::Vehicle:${vehicle.vehicle}`,
			updatedAt: recordedAt.toInstant().toString(),
		} satisfies VehicleJourney;
	});

	await redis.publish("journeys", JSON.stringify(vehicleJourneys));
	updateLog(`%s ► Published ${vehicleJourneys.length} vehicle journeys for line '${line.id}'.`, Temporal.Now.instant());
	await setTimeout(1500);
}
