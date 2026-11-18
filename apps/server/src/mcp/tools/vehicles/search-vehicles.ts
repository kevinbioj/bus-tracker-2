import { vehicleJourneyLineTypes } from "@bus-tracker/contracts";
import { and, eq, ilike, isNull } from "drizzle-orm";
import * as z from "zod";

import { database } from "../../../core/database/database.js";
import { operatorsTable, vehicleAirConditioningStatuses, vehiclesTable } from "../../../core/database/schema.js";
import { findOnlineLineId } from "../../../core/store/journey-store.js";
import { escapeLikePattern } from "../../../utils/search-text.js";
import { idSchema } from "../../../utils/validator-helpers.js";
import { defineTool } from "../../define-tool.js";
import { compareLineNumbers, loadLineLabels } from "../../lookups/lines.js";
import { getNetwork } from "../../lookups/networks.js";
import { vehicleUrl } from "../../presenters/links.js";
import { networkReferenceSchema, presentNetworkReference } from "../../presenters/references.js";
import { toLocalTime } from "../../presenters/time.js";

const PAGE_SIZE = 25;

const likeFilter = <Column extends Parameters<typeof ilike>[0]>(column: Column, value: string | undefined) =>
	value !== undefined ? ilike(column, `%${escapeLikePattern(value)}%`) : undefined;

export const searchVehiclesTool = defineTool({
	name: "search_vehicles",
	title: "Search the fleet of a network",
	description:
		"Search the vehicles of a network by fleet number, model, operator, type or air conditioning, and see whether each one is in service right now and on which line. Only networks with hasFleetData record their fleet.",
	icon: "vehicle",
	input: z.object({
		networkId: idSchema.describe("Network id from search_networks."),
		number: z.string().max(50).optional().describe("Fleet number, or part of it."),
		model: z.string().max(100).optional().describe("Model designation, e.g. 'Citaro' or 'Urbanway 12'."),
		operator: z.string().max(100).optional().describe("Operator name, or part of it."),
		type: z.enum(vehicleJourneyLineTypes).optional(),
		airConditioning: z.enum(vehicleAirConditioningStatuses).optional(),
		inServiceOnly: z.boolean().default(false).describe("Only keep vehicles running right now."),
		includeWithdrawn: z.boolean().default(false).describe("Also list vehicles withdrawn from the fleet."),
		page: z.number().int().min(0).max(100).default(0),
	}),
	output: z.object({
		network: networkReferenceSchema,
		total: z.number(),
		page: z.number(),
		hasMore: z.boolean(),
		vehicles: z.array(
			z.object({
				vehicleId: z.number(),
				number: z.string(),
				model: z.string().nullable(),
				type: z.enum(vehicleJourneyLineTypes).nullable(),
				operator: z.string().nullable(),
				inServiceNow: z.boolean(),
				currentLine: z.string().optional(),
				lastSeenAt: z.string().nullable(),
				withdrawn: z.boolean(),
				url: z.string(),
			}),
		),
	}),
	handler: async ({
		networkId,
		number,
		model,
		operator,
		type,
		airConditioning,
		inServiceOnly,
		includeWithdrawn,
		page,
	}) => {
		const network = await getNetwork(networkId);

		const rows = await database
			.select({ vehicle: vehiclesTable, operatorName: operatorsTable.name })
			.from(vehiclesTable)
			.leftJoin(operatorsTable, eq(operatorsTable.id, vehiclesTable.operatorId))
			.where(
				and(
					eq(vehiclesTable.networkId, networkId),
					likeFilter(vehiclesTable.number, number),
					likeFilter(vehiclesTable.designation, model),
					likeFilter(operatorsTable.name, operator),
					type !== undefined ? eq(vehiclesTable.type, type) : undefined,
					airConditioning !== undefined ? eq(vehiclesTable.airConditioning, airConditioning) : undefined,
					includeWithdrawn ? undefined : isNull(vehiclesTable.archivedAt),
				),
			);

		const matches = rows
			.map((row) => ({ ...row, onlineLineId: findOnlineLineId(row.vehicle.id) }))
			.filter((row) => !inServiceOnly || row.onlineLineId !== undefined)
			.toSorted((a, b) => compareLineNumbers(a.vehicle.number, b.vehicle.number));
		const pageRows = matches.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
		const lines = await loadLineLabels(pageRows.flatMap((row) => row.onlineLineId ?? []));

		return {
			network: presentNetworkReference(network),
			total: matches.length,
			page,
			hasMore: matches.length > (page + 1) * PAGE_SIZE,
			vehicles: pageRows.map(({ vehicle, operatorName, onlineLineId }) => ({
				vehicleId: vehicle.id,
				number: vehicle.number,
				model: vehicle.designation,
				type: vehicle.type,
				operator: operatorName,
				inServiceNow: onlineLineId !== undefined,
				currentLine: onlineLineId !== undefined ? lines.get(onlineLineId)?.number : undefined,
				lastSeenAt: vehicle.lastSeenAt !== null ? toLocalTime(vehicle.lastSeenAt, network.timezone) : null,
				withdrawn: vehicle.archivedAt !== null,
				url: vehicleUrl(vehicle.id),
			})),
		};
	},
});
