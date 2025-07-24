import { setTimeout } from "node:timers/promises";
import type { VehicleJourney } from "@bus-tracker/contracts";
import DraftLog from "draftlog";
import { XMLParser } from "fast-xml-parser";
import { createClient } from "redis";
import { Temporal } from "temporal-polyfill";

import { WS_ENDPOINT } from "./constants.js";
import { fetchSiriData } from "./siri.js";
import type { APIResponse } from "./types.js";

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

let siriData = await fetchSiriData();
setInterval(async () => {
	siriData = await fetchSiriData();
}, 30_000);

const parser = new XMLParser();

while (true) {
	const updateLog = console.draft("%s ► 1/3 – Downloading latest data from provider...", Temporal.Now.instant());

	const response = await fetch(WS_ENDPOINT);
	const rawData = await response.text();
	const payload = parser.parse(rawData) as APIResponse;

	const now = Temporal.Now.zonedDateTimeISO();

	const vehicles =
		typeof payload.liste?.vehicule !== "undefined"
			? Array.isArray(payload.liste.vehicule)
				? payload.liste.vehicule
				: [payload.liste.vehicule]
			: [];

	updateLog("%s ► 2/3 – Processing %d vehicles from provider...", Temporal.Now.instant(), vehicles.length);

	const vehicleJourneys = vehicles.flatMap((vehicle) => {
		if (typeof vehicle.jour === "undefined") return [];
		if (vehicle.ligne === 0 || vehicle.course === 0 || vehicle.destination === "DEPOT AUTOBUS") return [];

		const [date, time] = vehicle.jour.split(" ");
		const recordedAt = Temporal.PlainDateTime.from(`${date}T${time}`).toZonedDateTime("Europe/Paris");

		if (now.since(recordedAt).total("minutes") > 10) return [];

		let journeyData = siriData.get(vehicle.course);
		if (typeof journeyData !== "undefined" && now.toInstant().since(journeyData.recordedAt).total("minutes") > 5) {
			journeyData = undefined;
		}

		const calls =
			typeof journeyData !== "undefined"
				? Array.isArray(journeyData.journey.EstimatedCalls.EstimatedCall)
					? journeyData.journey.EstimatedCalls.EstimatedCall
					: [journeyData.journey.EstimatedCalls.EstimatedCall]
				: undefined;

		const monitoredCallIndex =
			calls?.findLastIndex((call) => call.VehicleAtStop || call.ArrivalStatus === "arrived") ?? -1;
		const monitoredCall = monitoredCallIndex > -1 ? calls![monitoredCallIndex] : undefined;

		return {
			id: `DKBUS::VehicleTracking:${vehicle.numero}`,
			line: {
				ref: `DKBUS:Line:${vehicle.ligne}`,
				number: String(vehicle.ligne),
				type: "BUS",
			},
			destination: vehicle.destination !== 0 ? vehicle.destination : undefined,
			position: {
				latitude: +vehicle.lat,
				longitude: +vehicle.lng,
				atStop: monitoredCall?.VehicleAtStop ?? false,
				type: "GPS",
				recordedAt: recordedAt.toString({ timeZoneName: "never" }),
			},
			calls: calls?.slice(monitoredCallIndex + (monitoredCall?.VehicleAtStop ? 0 : 1)).map((call) => ({
				aimedTime: call.AimedArrivalTime,
				expectedTime: Temporal.PlainDateTime.from(call.ExpectedArrivalTime.slice(0, -6))
					.toZonedDateTime("Europe/Paris")
					.toString({ timeZoneName: "never" }),
				stopOrder: call.Order % 100,
				callStatus: "SCHEDULED",
				stopName: call.StopPointName,
				stopRef: call.StopPointRef,
			})),
			occupancy: vehicle.comptage > 60 ? "HIGH" : vehicle.comptage > 30 ? "MEDIUM" : "LOW",
			networkRef: "DKBUS",
			vehicleRef: `DKBUS::Vehicle:${vehicle.numero}`,
			updatedAt: recordedAt.toInstant().toString(),
		} satisfies VehicleJourney;
	});

	updateLog("%s ► 3/3 – Published %d vehicle journeys.", Temporal.Now.instant(), vehicles.length);
	await redis.publish("journeys", JSON.stringify(vehicleJourneys));
	await setTimeout(30_000);
}
