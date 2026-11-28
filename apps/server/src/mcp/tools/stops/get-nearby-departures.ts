import * as z from "zod";

import { buildNearbyDepartures } from "../../../core/services/nearby-departures-service.js";
import { defineTool } from "../../define-tool.js";
import { loadLineLabels } from "../../lookups/lines.js";
import { loadNetworks } from "../../lookups/networks.js";
import { DEFAULT_TIMEZONE, nowIn, toLocalTime } from "../../presenters/time.js";

export const getNearbyDeparturesTool = defineTool({
	name: "get_nearby_departures",
	title: "Nearby departures",
	description:
		"Next departures that can be caught on foot around coordinates, across every stop within walking reach (up to 15 km in sparse areas), each trip listed once at its most convenient stop. At most 15 departures, ranked by waiting time plus walking time (walking counts double), so an imminent departure far away ranks below a slightly later one next door; departures that cannot be reached in time on foot are left out. Use it for 'what can I catch near me' questions; convert the user's place to coordinates first.",
	icon: "stop",
	input: z.object({
		latitude: z.number().min(-90).max(90),
		longitude: z.number().min(-180).max(180),
	}),
	output: z.object({
		now: z.string(),
		departures: z.array(
			z.object({
				line: z.string().optional(),
				lineId: z.number().optional(),
				network: z.string().optional(),
				destination: z.string().optional(),
				stop: z.object({ stopRef: z.string(), name: z.string() }),
				platform: z.string().optional(),
				distanceMeters: z.number().describe("Straight-line distance from the coordinates to the platform."),
				scheduled: z.string(),
				expected: z.string().optional(),
				minutesAway: z.number(),
				realtime: z.boolean(),
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
	handler: async ({ latitude, longitude }) => {
		const { departures } = await buildNearbyDepartures({ latitude, longitude });
		const [networks, lines] = await Promise.all([
			loadNetworks(),
			loadLineLabels(departures.flatMap((departure) => departure.lineId ?? [])),
		]);
		const timezoneOf = (networkId?: number) =>
			(networkId !== undefined ? networks.get(networkId)?.timezone : undefined) ?? DEFAULT_TIMEZONE;
		const nowMs = Date.now();

		return {
			now: nowIn(timezoneOf(departures[0]?.lineNetworkId)),
			departures: departures.map((departure) => {
				const timezone = timezoneOf(departure.lineNetworkId);
				return {
					line: departure.lineId !== undefined ? lines.get(departure.lineId)?.number : undefined,
					lineId: departure.lineId,
					network: departure.lineNetworkId !== undefined ? networks.get(departure.lineNetworkId)?.name : undefined,
					destination: departure.destination,
					stop: { stopRef: departure.stopAreaRef, name: departure.stopAreaName },
					platform: departure.platformName,
					distanceMeters: departure.distance,
					scheduled: toLocalTime(departure.aimedTime, timezone),
					expected: departure.expectedTime !== undefined ? toLocalTime(departure.expectedTime, timezone) : undefined,
					minutesAway: Math.max(
						0,
						Math.round((Date.parse(departure.expectedTime ?? departure.aimedTime) - nowMs) / 60_000),
					),
					realtime: departure.realtime === true,
					potentiallyCancelled: departure.potentiallyCanceled === true,
					vehicleTracked: departure.tracked,
					vehicleAtStop: departure.atStop,
					onDemand: departure.onDemand,
					wheelchairAccessible: departure.wheelchairAccessible,
					journeyId: departure.journeyId,
				};
			}),
		};
	},
});
