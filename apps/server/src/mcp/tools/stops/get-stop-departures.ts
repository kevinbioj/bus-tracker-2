import * as z from "zod";

import { buildStopDepartures } from "../../../core/services/stop-board-service.js";
import { idSchema } from "../../../utils/validator-helpers.js";
import { defineTool, ToolFailure } from "../../define-tool.js";
import { loadLineLabels } from "../../lookups/lines.js";
import { networkNames, timezoneOf } from "../../lookups/networks.js";
import { nowIn, toLocalTime } from "../../presenters/time.js";

const directionSchema = z.enum(["departures", "arrivals"]);

export const getStopDeparturesTool = defineTool({
	name: "get_stop_departures",
	title: "Next departures at a stop",
	description:
		"Next departures (or arrivals) at a stop within the next two hours, merging timetables, real-time predictions and tracked vehicles. Pass a platform ref from get_stop to restrict to one platform, and lineId to restrict to one line.",
	icon: "stop",
	input: z.object({
		stopRef: z.string().min(1).max(200).describe("Stop ref from search_stops, or platform ref from get_stop."),
		lineId: idSchema.optional().describe("Only keep departures of this line."),
		direction: directionSchema
			.default("departures")
			.describe("Arrivals are only available when get_stop reports hasArrivalsBoard."),
	}),
	output: z.object({
		now: z.string(),
		stop: z.object({ stopRef: z.string(), name: z.string(), networks: z.array(z.string()) }),
		platformRef: z.string().optional(),
		direction: directionSchema,
		departures: z.array(
			z.object({
				line: z.string().optional(),
				lineId: z.number().optional(),
				destination: z.string().optional(),
				origin: z.string().optional(),
				platform: z.string().optional(),
				scheduled: z.string(),
				expected: z.string().optional(),
				minutesAway: z.number(),
				realtime: z.boolean(),
				cancelled: z.boolean(),
				potentiallyCancelled: z
					.boolean()
					.describe(
						"The trip is probably not operated (no vehicle assigned long after its departure): shown as possibly cancelled.",
					),
				vehicleTracked: z.boolean(),
				vehicleAtStop: z.boolean(),
				onDemand: z
					.enum(["DRIVER", "PHONE"])
					.optional()
					.describe("Stop served on request: wave at the driver or book by phone."),
				wheelchairAccessible: z.boolean().optional(),
				journeyId: z.string().optional(),
			}),
		),
	}),
	handler: async ({ stopRef, lineId, direction }) => {
		const result = await buildStopDepartures(stopRef, direction, lineId !== undefined ? [lineId] : undefined);
		if ("error" in result) throw new ToolFailure(result.error ?? "Unable to compute departures.");

		const { stop, stopPointRef, departures } = result.payload;
		const [timezone, networks, lines] = await Promise.all([
			timezoneOf(stop.networkId),
			networkNames(stop.networkIds),
			loadLineLabels(departures.flatMap((departure) => departure.lineId ?? [])),
		]);
		const nowMs = Date.now();

		return {
			now: nowIn(timezone),
			stop: { stopRef: stop.ref, name: stop.name, networks },
			platformRef: stopPointRef,
			direction,
			departures: departures.map((departure) => ({
				line: departure.lineId !== undefined ? lines.get(departure.lineId)?.number : undefined,
				lineId: departure.lineId,
				destination: departure.destination,
				origin: departure.originName,
				platform: departure.platformName,
				scheduled: toLocalTime(departure.aimedTime, timezone),
				expected: departure.expectedTime !== undefined ? toLocalTime(departure.expectedTime, timezone) : undefined,
				minutesAway: Math.max(
					0,
					Math.round((Date.parse(departure.expectedTime ?? departure.aimedTime) - nowMs) / 60_000),
				),
				realtime: departure.realtime === true,
				cancelled: departure.callStatus === "SKIPPED",
				potentiallyCancelled: departure.potentiallyCanceled === true,
				vehicleTracked: departure.tracked,
				vehicleAtStop: departure.atStop,
				onDemand: departure.onDemand,
				wheelchairAccessible: departure.wheelchairAccessible,
				journeyId: departure.journeyId,
			})),
		};
	},
});
