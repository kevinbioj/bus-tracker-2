import { vehicleJourneyLineTypes } from "@bus-tracker/contracts";
import { desc, eq } from "drizzle-orm";
import * as z from "zod";

import { database } from "../../../core/database/database.js";
import {
	lineActivitiesTable,
	operatorsTable,
	vehicleAirConditioningStatuses,
	vehicleArchiveReasons,
	vehiclesTable,
} from "../../../core/database/schema.js";
import { findJourneysByVehicleId, findOnlineLineId } from "../../../core/store/journey-store.js";
import { idSchema } from "../../../utils/validator-helpers.js";
import { defineTool, ToolFailure } from "../../define-tool.js";
import { loadLineLabels } from "../../lookups/lines.js";
import { getNetwork } from "../../lookups/networks.js";
import { journeySchema, presentJourney } from "../../presenters/journey.js";
import { vehicleUrl } from "../../presenters/links.js";
import { networkReferenceSchema, presentNetworkReference } from "../../presenters/references.js";
import { nowIn, toLocalTime } from "../../presenters/time.js";

const RECENT_ASSIGNMENTS = 10;
const NEXT_CALLS = 5;

export const getVehicleTool = defineTool({
	name: "get_vehicle",
	title: "Details of a vehicle",
	description:
		"Record of a vehicle: model, type, operator, equipment (air conditioning, USB ports), withdrawal status, the journey it runs right now (line, destination, delay, next stops, position) and its latest line assignments. Use get_vehicle_history for a full month.",
	icon: "vehicle",
	input: z.object({
		vehicleId: idSchema.describe("Vehicle id from search_vehicles."),
	}),
	output: z.object({
		now: z.string(),
		vehicleId: z.number(),
		number: z.string(),
		model: z.string().nullable(),
		type: z.enum(vehicleJourneyLineTypes).nullable(),
		network: networkReferenceSchema,
		operator: z.string().nullable(),
		airConditioning: z.enum(vehicleAirConditioningStatuses).nullable(),
		usbPorts: z.boolean().nullable(),
		withdrawn: z.boolean(),
		withdrawalReason: z.enum(vehicleArchiveReasons).nullable(),
		inServiceNow: z.boolean(),
		currentLine: z.string().optional(),
		currentJourney: journeySchema.optional(),
		lastSeenAt: z.string().nullable(),
		recentLineAssignments: z.array(
			z.object({
				line: z.string().optional(),
				lineId: z.number(),
				serviceDate: z.string(),
				from: z.string(),
				to: z.string(),
			}),
		),
		url: z.string(),
	}),
	handler: async ({ vehicleId }) => {
		const [row] = await database
			.select({ vehicle: vehiclesTable, operatorName: operatorsTable.name })
			.from(vehiclesTable)
			.leftJoin(operatorsTable, eq(operatorsTable.id, vehiclesTable.operatorId))
			.where(eq(vehiclesTable.id, vehicleId));
		if (row === undefined) throw new ToolFailure(`No vehicle found with id ${vehicleId}. Use search_vehicles.`);

		const { vehicle, operatorName } = row;
		const network = await getNetwork(vehicle.networkId);

		const recentActivities = await database
			.select({
				lineId: lineActivitiesTable.lineId,
				serviceDate: lineActivitiesTable.serviceDate,
				startedAt: lineActivitiesTable.startedAt,
				updatedAt: lineActivitiesTable.updatedAt,
			})
			.from(lineActivitiesTable)
			.where(eq(lineActivitiesTable.vehicleId, vehicle.id))
			.orderBy(desc(lineActivitiesTable.startedAt))
			.limit(RECENT_ASSIGNMENTS);

		const journey = findJourneysByVehicleId().get(vehicle.id);
		const onlineLineId = findOnlineLineId(vehicle.id);
		const lines = await loadLineLabels([
			...recentActivities.map((activity) => activity.lineId),
			...(journey?.lineId !== undefined ? [journey.lineId] : []),
			...(onlineLineId !== undefined ? [onlineLineId] : []),
		]);

		return {
			now: nowIn(network.timezone),
			vehicleId: vehicle.id,
			number: vehicle.number,
			model: vehicle.designation,
			type: vehicle.type,
			network: presentNetworkReference(network),
			operator: operatorName,
			airConditioning: vehicle.airConditioning,
			usbPorts: vehicle.usbPorts,
			withdrawn: vehicle.archivedAt !== null,
			withdrawalReason: vehicle.archivedFor,
			inServiceNow: onlineLineId !== undefined,
			currentLine: onlineLineId !== undefined ? lines.get(onlineLineId)?.number : undefined,
			currentJourney:
				journey !== undefined
					? presentJourney(journey, {
							timezone: network.timezone,
							lineNumber: journey.lineId !== undefined ? lines.get(journey.lineId)?.number : undefined,
							callCount: NEXT_CALLS,
						})
					: undefined,
			lastSeenAt: vehicle.lastSeenAt !== null ? toLocalTime(vehicle.lastSeenAt, network.timezone) : null,
			recentLineAssignments: recentActivities.map((activity) => ({
				line: lines.get(activity.lineId)?.number,
				lineId: activity.lineId,
				serviceDate: activity.serviceDate,
				from: toLocalTime(activity.startedAt, network.timezone),
				to: toLocalTime(activity.updatedAt, network.timezone),
			})),
			url: vehicleUrl(vehicle.id),
		};
	},
});
