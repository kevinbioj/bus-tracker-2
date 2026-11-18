import { stopAreaModes } from "@bus-tracker/contracts";
import * as z from "zod";

import { findStopAlerts } from "../../../core/services/service-alert-service.js";
import { defineTool } from "../../define-tool.js";
import { compareLineNumbers, lineNumbersOfRefs } from "../../lookups/lines.js";
import { networkNames, timezoneOf } from "../../lookups/networks.js";
import { resolveStop } from "../../lookups/stops.js";
import { alertSchema, presentAlert } from "../../presenters/alert.js";
import { stopSummarySchema } from "../../presenters/stop.js";
import { nowIn } from "../../presenters/time.js";

export const getStopTool = defineTool({
	name: "get_stop",
	title: "Stop details",
	description:
		"Details of a stop area: its platforms (code, wheelchair access, lines served by each platform, platform ref usable in get_stop_departures), networks, whether arrivals are available, and active traffic alerts aimed at the stop.",
	icon: "stop",
	input: z.object({
		stopRef: z.string().min(1).max(200).describe("Stop ref from search_stops or find_stops_nearby."),
	}),
	output: stopSummarySchema.omit({ distanceMeters: true }).extend({
		now: z.string(),
		hasArrivalsBoard: z.boolean(),
		platforms: z.array(
			z.object({
				platformRef: z.string(),
				name: z.string().optional(),
				code: z.string().optional(),
				mode: z.enum(stopAreaModes).optional(),
				wheelchairAccessible: z.boolean().optional(),
				lines: z.array(z.string()),
				latitude: z.number(),
				longitude: z.number(),
			}),
		),
		alerts: z.array(alertSchema),
	}),
	handler: async ({ stopRef }) => {
		const { stopArea } = await resolveStop(stopRef);
		const stopPoints = stopArea.stopPoints ?? [];

		const [lines, networks, timezone, alerts] = await Promise.all([
			lineNumbersOfRefs([...stopArea.lineRefs, ...stopPoints.flatMap((stopPoint) => stopPoint.lineRefs ?? [])]),
			networkNames(stopArea.networkIds),
			timezoneOf(stopArea.networkId),
			findStopAlerts(stopArea, new Set(stopArea.stopRefs)),
		]);
		const numbersOf = (lineRefs: string[]) =>
			[...new Set(lineRefs.flatMap((lineRef) => lines.get(lineRef)?.number ?? []))].toSorted(compareLineNumbers);

		return {
			now: nowIn(timezone),
			stopRef: stopArea.ref,
			name: stopArea.name,
			mode: stopArea.mode ?? "BUS",
			latitude: stopArea.latitude,
			longitude: stopArea.longitude,
			networks,
			lines: numbersOf(stopArea.lineRefs),
			hasArrivalsBoard: stopArea.arrivals === true,
			platforms: stopPoints.map((stopPoint) => ({
				platformRef: stopPoint.ref,
				name: stopPoint.name,
				code: stopPoint.platformCode,
				mode: stopPoint.mode,
				wheelchairAccessible: stopPoint.wheelchairBoarding,
				lines: numbersOf(stopPoint.lineRefs ?? stopArea.lineRefs),
				latitude: stopPoint.latitude,
				longitude: stopPoint.longitude,
			})),
			alerts: alerts.map(presentAlert),
		};
	},
});
