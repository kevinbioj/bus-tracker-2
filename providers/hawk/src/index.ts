import { setTimeout } from "node:timers/promises";
import type { VehicleJourney } from "@bus-tracker/contracts";
import { captureException, initMonitoring } from "@bus-tracker/monitoring";
import { createRedisClient } from "@bus-tracker/redis";
import dayjs from "dayjs";
import customParseFormatPlugin from "dayjs/plugin/customParseFormat.js";
import timezonePlugin from "dayjs/plugin/timezone.js";
import utcPlugin from "dayjs/plugin/utc.js";

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

initMonitoring(`processor-hawk:${HAWK_ID}`);

console.log("► Connecting to Redis.");
const redis = createRedisClient();
const channel = process.env.REDIS_CHANNEL ?? "journeys";
await redis.connect();
console.log(`► Connected! Journeys will be published into '${channel}'.`);
console.log();

while (true) {
	if (!redis.isReady) {
		console.warn("✘ Redis is unavailable, skipping cycle.");
		await setTimeout(30_000);
		continue;
	}

	console.log(`► Fetching vehicles from Hawk <${HAWK_ID}>...`);
	const response = await fetch(
		`https://hawk.hanoverdisplays.com/${HAWK_ID}/api/vehicles/poi?info=${INFO_TOKEN}&isSAEIVMode=true&culture=fr-FR&hasOperator=false&hasTransporter=false&isUsingMetricSystem=true&hasCapacity=false&userId=1&driverInfo=1&ShowAssignedOnly=false&assignment_state_exists=false&vehicle_phone_number_exists=true`,
	);
	if (!response.ok) {
		console.error(`✘ Failed to fetch data from Hawk (status ${response.status}).`);
		await setTimeout(5000);
		continue;
	}

	const now = Temporal.Now.instant();

	const vehicles = (await response.json()) as Vehicle[];

	const vehicleJourneys = vehicles.flatMap((vehicle) => {
		if (vehicle.PopUpText.includes("Eteint") || vehicle.PopUpText.includes("SwitchedOff")) {
			console.log(`\t⛛ ${vehicle.ParcNumber} > OFF`);
			return [];
		}

		const lineResult = lineRegex.exec(vehicle.PopUpText);
		const destinationResult = destinationRegex.exec(vehicle.PopUpText);
		const lastLocResult = lastLocRegex.exec(vehicle.PopUpText);
		if (lineResult === null || destinationResult === null || lastLocResult === null) {
			console.log(`\t✘ ${vehicle.ParcNumber} > Failed to extract info ("${vehicle.PopUpText}")`);
			return [];
		}

		const [, line] = lineResult;
		const [, destination] = destinationResult;
		const [, lastPositionAt] = lastLocResult;
		console.log(`\t⛛ ${vehicle.ParcNumber} OK (LIGNE:${line} / DEST:${destination} / LAST POS.:${lastPositionAt})`);

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

	try {
		await redis.publish("journeys", JSON.stringify(vehicleJourneys));
		console.log(`✓ Published ${vehicleJourneys.length} vehicle journeys`);
	} catch (e) {
		console.error("✘ Failed to publish vehicle journeys:", e);
		captureException(e);
	}
	console.log();
	await setTimeout(30_000);
}
