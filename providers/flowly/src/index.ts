import { setTimeout } from "node:timers/promises";
import DraftLog from "draftlog";
import { createClient } from "redis";
import { Temporal } from "temporal-polyfill";

import type { VehicleJourney } from "@bus-tracker/contracts";

if (process.argv.length < 3) {
	console.error("Usage: flowly <flowly id> <network ref>");
	process.exit(1);
}

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

const [, , flowlyId, networkRef] = process.argv;

while (true) {
	const updateLog = console.draft("%s ► Fetching vehicles from Flowly...", Temporal.Now.instant());

	const response = await fetch(`https://${flowlyId}.flowly.re/Portal/MapDevices.aspx`);
	if (!response.ok) {
		await setTimeout(5000);
		continue;
	}

	const now = Temporal.Now.instant();

	const text = await response.text();
	const textLines = text.split(/\r?\n/g);

	const vehicleMarkers = textLines.flatMap((line) => {
		const sanitizedLine = line.trim();
		return sanitizedLine.startsWith("vehicles.set") ? sanitizedLine : [];
	});

	const vehiclePopups = textLines.flatMap((line) => {
		const sanitizedLine = line.trim();
		return sanitizedLine.startsWith("vehicles.get") ? sanitizedLine : [];
	});

	const extractPosition = (line: string) => {
		const coupleStart = line.slice(line.indexOf("marker([") + 8);
		const latitude = +coupleStart.slice(0, coupleStart.indexOf(","));
		const longitude = +coupleStart.slice(coupleStart.indexOf(",") + 1, coupleStart.indexOf("]"));
		if (Number.isNaN(latitude) || Number.isNaN(longitude)) return;
		return { latitude, longitude };
	};

	const vehicleJourneys = vehiclePopups.flatMap((vehicleInstruction) => {
		const vehicleId = /\( (\w\d+) \)/.exec(vehicleInstruction)?.at(1);
		if (typeof vehicleId === "undefined") return [];

		const positionLine = vehicleMarkers.find((marker) => marker.startsWith(`vehicles.set('${vehicleId}',`));
		const position = extractPosition(positionLine ?? "");
		if (typeof position === "undefined") return [];

		const lineName = /title="Ligne (\w+)"/.exec(vehicleInstruction)?.at(1);
		const lineColors = /style="background-color:#(\w{6});color:#(\w{6})"/.exec(vehicleInstruction)?.slice(1) ?? [];
		const directionId = vehicleInstruction.includes("Aller") ? "OUTBOUND" : "INBOUND";
		const destination = /<i class="far fa-arrow-alt-circle-right mr-1"><\/i>(.+)</g
			.exec(vehicleInstruction)
			?.at(1)
			?.replaceAll("\\", "")
			.replace(/<br.*/, "");

		return {
			id: `${networkRef}::VehicleTracking:${vehicleId}`,
			line: {
				ref: `${networkRef}:Line:${lineName ?? "?"}`,
				number: lineName ?? "?",
				type: "BUS",
				color: lineColors[0]?.toUpperCase() ?? "FFFFFF",
				textColor: lineColors[1]?.toUpperCase() ?? "000000",
			},
			direction: directionId,
			destination,
			position: {
				latitude: position.latitude,
				longitude: position.longitude,
				atStop: false,
				type: "GPS",
				recordedAt: now.toZonedDateTimeISO("Europe/Paris").toString({ timeZoneName: "never" }),
			},
			networkRef: networkRef!,
			vehicleRef: `${networkRef}::Vehicle:${vehicleId}`,
			updatedAt: now.toString(),
		} satisfies VehicleJourney;
	});

	await redis.publish("journeys", JSON.stringify(vehicleJourneys));
	updateLog(`%s ► Published ${vehicleJourneys.length} vehicle journeys`, Temporal.Now.instant());
	await setTimeout(30_000);
}
