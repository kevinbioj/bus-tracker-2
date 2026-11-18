import { getVehicleJourneyPositionType, vehicleJourneyPositionTypes } from "@bus-tracker/contracts";
import * as z from "zod";

import { journeyStore } from "../../../core/store/journey-store.js";
import { distanceMeters } from "../../../utils/geo.js";
import { idSchema } from "../../../utils/validator-helpers.js";
import { defineTool } from "../../define-tool.js";
import { loadLineLabels } from "../../lookups/lines.js";
import { loadNetworks } from "../../lookups/networks.js";
import { journeySchema, presentJourney } from "../../presenters/journey.js";
import { DEFAULT_TIMEZONE } from "../../presenters/time.js";

const MAX_VEHICLES = 25;
const NEXT_CALLS = 2;

export const findNearbyVehiclesTool = defineTool({
	name: "find_nearby_vehicles",
	title: "Vehicles around a place",
	description:
		"Journeys tracked right now around coordinates, closest first: line, destination, vehicle, delay and next stops. By default only GPS-located vehicles are returned, since other positions are estimated from timetables.",
	icon: "vehicle",
	input: z.object({
		latitude: z.number().min(-90).max(90),
		longitude: z.number().min(-180).max(180),
		radiusMeters: z.number().int().min(50).max(5_000).default(1_000),
		networkId: idSchema.optional().describe("Only keep journeys of this network."),
		positionTypes: z
			.array(z.enum(vehicleJourneyPositionTypes))
			.default(["GPS"])
			.describe("GPS = located by the vehicle, ESTIMATED = real-time timetable, SCHEDULED = theoretical timetable."),
	}),
	output: z.object({
		vehicles: z.array(journeySchema.extend({ distanceMeters: z.number() })),
	}),
	handler: async ({ latitude, longitude, radiusMeters, networkId, positionTypes }) => {
		const origin = { latitude, longitude };
		const nearby = journeyStore
			.values()
			.filter(
				(journey) =>
					(networkId === undefined || journey.networkId === networkId) &&
					positionTypes.includes(getVehicleJourneyPositionType(journey)),
			)
			.map((journey) => ({ journey, distance: distanceMeters(origin, journey.position) }))
			.filter(({ distance }) => distance <= radiusMeters)
			.toArray()
			.toSorted((a, b) => a.distance - b.distance)
			.slice(0, MAX_VEHICLES);

		const [networks, lines] = await Promise.all([
			loadNetworks(),
			loadLineLabels(nearby.flatMap(({ journey }) => journey.lineId ?? [])),
		]);

		return {
			vehicles: nearby.map(({ journey, distance }) => ({
				...presentJourney(journey, {
					timezone: networks.get(journey.networkId)?.timezone ?? DEFAULT_TIMEZONE,
					lineNumber: journey.lineId !== undefined ? lines.get(journey.lineId)?.number : undefined,
					callCount: NEXT_CALLS,
				}),
				distanceMeters: Math.round(distance),
			})),
		};
	},
});
