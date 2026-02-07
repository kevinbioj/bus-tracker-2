import { setTimeout } from "node:timers/promises";
import type { VehicleJourney } from "@bus-tracker/contracts";
import dayjs from "dayjs";
import customParseFormatPlugin from "dayjs/plugin/customParseFormat.js";
import timezonePlugin from "dayjs/plugin/timezone.js";
import utcPlugin from "dayjs/plugin/utc.js";
import DraftLog from "draftlog";
import { createClient } from "redis";
import { Temporal } from "temporal-polyfill";

import type { Vehicle } from "./vehicle.js";

dayjs.extend(customParseFormatPlugin);
dayjs.extend(timezonePlugin);
dayjs.extend(utcPlugin);

const { NETWORK_REF, HAWK_ID, INFO_TOKEN, OPERATOR_REF } = process.env;

if (NETWORK_REF === undefined || HAWK_ID === undefined || INFO_TOKEN === undefined) {
	throw new Error("NETWORK_REF, HAWK_ID and INFO_TOKEN environment variables must be defined");
}

const lineRegex = /(?:{Route}:|Ligne:)(?:\s*<\/?[^>]+>)*\s*(?:<[^>]+>)?([\w\d-]+)(?:<\/[^>]+>)?/i;
const destinationRegex = /(?:{RunDestination}:|Destination:)\s*([^<\n]+)/i;
const lastLocRegex = /(?:{LastLoc}:|Dernière position:)\s*([\d]{2}\/[\d]{2}\/[\d]{4} [\d]{2}:[\d]{2}:[\d]{2})/i;

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

while (true) {
	const updateLog = console.draft("%s ► Fetching vehicles from Hawk <%s>...", Temporal.Now.instant());
	const response = await fetch(
		`https://hawk.hanoverdisplays.com/${HAWK_ID}/api/vehicles/poi?info=${INFO_TOKEN}&isSAEIVMode=true&culture=fr-FR&hasOperator=false&hasTransporter=false&isUsingMetricSystem=true&hasCapacity=false&userId=1&driverInfo=1&ShowAssignedOnly=false&assignment_state_exists=false&vehicle_phone_number_exists=true`,
	);
	if (!response.ok) {
		updateLog("%s ► Failed to fetch data from Hawk (status %d).", Temporal.Now.instant(), response.status);
		await setTimeout(5000);
		continue;
	}

	const now = Temporal.Now.instant();

	const vehicles = (await response.json()) as Vehicle[];

	const vehicleJourneys = vehicles.flatMap((vehicle) => {
		if (vehicle.PopUpText.includes("Eteint") || vehicle.PopUpText.includes("SwitchedOff")) {
			console.log(`		${vehicle.ParcNumber} > OFF`);
			return [];
		}

		const lineResult = lineRegex.exec(vehicle.PopUpText);
		const destinationResult = destinationRegex.exec(vehicle.PopUpText);
		const lastLocResult = lastLocRegex.exec(vehicle.PopUpText);
		if (lineResult === null || destinationResult === null || lastLocResult === null) {
			console.log(`		${vehicle.ParcNumber} > Failed to extract info ("${vehicle.PopUpText}")`);
			return [];
		}

		const [, line] = lineResult;
		const [, destination] = destinationResult;
		const [, lastPositionAt] = lastLocResult;
		console.log(`		${vehicle.ParcNumber} OK (LIGNE:${line} / DEST:${destination} / LAST POS.:${lastPositionAt})`);

		console.log(lastPositionAt);

		const lastPositionAtDate = dayjs.tz(lastPositionAt, "DD/MM/YYYY HH:mm:ss", "Europe/Paris").toDate();

		if (Date.now() - lastPositionAtDate.getTime() > 10 * 60_000) return [];

		return {
			id: `${NETWORK_REF}:${OPERATOR_REF ?? ""}:VehicleTracking:${vehicle.ParcNumber}`,
			line: {
				ref: `${NETWORK_REF}:Line:${line ?? "?"}`,
				number: line ?? "?",
				type: "BUS",
				color: "FFFFFF",
				textColor: "000000",
			},
			destination,
			position: {
				latitude: +vehicle.Latitude,
				longitude: +vehicle.Longitude,
				atStop: false,
				type: "GPS",
				recordedAt: Temporal.Instant.fromEpochMilliseconds(lastPositionAtDate.getTime())
					.toZonedDateTimeISO("Europe/Paris")
					.toString({ timeZoneName: "never" }),
			},
			networkRef: NETWORK_REF,
			operatorRef: OPERATOR_REF,
			vehicleRef: `${NETWORK_REF}:${OPERATOR_REF ?? ""}:Vehicle:${vehicle.ParcNumber}`,
			updatedAt: now.toString(),
		} satisfies VehicleJourney;
	});

	await redis.publish("journeys", JSON.stringify(vehicleJourneys));
	updateLog(`%s ► Published ${vehicleJourneys.length} vehicle journeys`, Temporal.Now.instant());
	console.log();
	await setTimeout(30_000);
}
