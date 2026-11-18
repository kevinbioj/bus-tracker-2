import { eq } from "drizzle-orm";
import * as z from "zod";

import { database } from "../../../core/database/database.js";
import { operatorsTable, vehiclesTable } from "../../../core/database/schema.js";
import { findOnlineLineId } from "../../../core/store/journey-store.js";
import { idSchema } from "../../../utils/validator-helpers.js";
import { defineTool } from "../../define-tool.js";
import { getNetwork } from "../../lookups/networks.js";
import { networkReferenceSchema, presentNetworkReference } from "../../presenters/references.js";

const MAX_BREAKDOWN_ENTRIES = 30;
const UNKNOWN = "unknown";

const breakdownSchema = z.array(z.object({ value: z.string(), active: z.number(), inServiceNow: z.number() }));

type FleetRow = { key: string; archived: boolean; inService: boolean };

function breakdown(rows: FleetRow[]) {
	return Map.groupBy(
		rows.filter((row) => !row.archived),
		(row) => row.key,
	)
		.entries()
		.map(([value, group]) => ({
			value,
			active: group.length,
			inServiceNow: group.filter((row) => row.inService).length,
		}))
		.toArray()
		.toSorted((a, b) => b.active - a.active || a.value.localeCompare(b.value))
		.slice(0, MAX_BREAKDOWN_ENTRIES);
}

export const getFleetOverviewTool = defineTool({
	name: "get_fleet_overview",
	title: "Fleet overview of a network",
	description:
		"Statistics about a network's fleet: active and withdrawn vehicles, vehicles in service right now, and breakdowns by model, operator, vehicle type and air conditioning. Only meaningful for networks with hasFleetData.",
	icon: "vehicle",
	input: z.object({
		networkId: idSchema.describe("Network id from search_networks."),
	}),
	output: z.object({
		network: networkReferenceSchema,
		activeVehicles: z.number(),
		withdrawnVehicles: z.number(),
		inServiceNow: z.number(),
		withdrawalReasons: z.array(z.object({ reason: z.string(), count: z.number() })),
		byModel: breakdownSchema,
		byOperator: breakdownSchema,
		byType: breakdownSchema,
		byAirConditioning: breakdownSchema,
	}),
	handler: async ({ networkId }) => {
		const network = await getNetwork(networkId);

		const vehicles = await database
			.select({
				id: vehiclesTable.id,
				designation: vehiclesTable.designation,
				type: vehiclesTable.type,
				airConditioning: vehiclesTable.airConditioning,
				archivedAt: vehiclesTable.archivedAt,
				archivedFor: vehiclesTable.archivedFor,
				operatorName: operatorsTable.name,
			})
			.from(vehiclesTable)
			.leftJoin(operatorsTable, eq(operatorsTable.id, vehiclesTable.operatorId))
			.where(eq(vehiclesTable.networkId, networkId));

		const rowsBy = (keyOf: (vehicle: (typeof vehicles)[number]) => string | null) =>
			vehicles.map((vehicle) => ({
				key: keyOf(vehicle) ?? UNKNOWN,
				archived: vehicle.archivedAt !== null,
				inService: findOnlineLineId(vehicle.id) !== undefined,
			}));

		const withdrawn = vehicles.filter((vehicle) => vehicle.archivedAt !== null);

		return {
			network: presentNetworkReference(network),
			activeVehicles: vehicles.length - withdrawn.length,
			withdrawnVehicles: withdrawn.length,
			inServiceNow: vehicles.filter((vehicle) => findOnlineLineId(vehicle.id) !== undefined).length,
			withdrawalReasons: Map.groupBy(withdrawn, (vehicle) => vehicle.archivedFor ?? UNKNOWN)
				.entries()
				.map(([reason, group]) => ({ reason, count: group.length }))
				.toArray()
				.toSorted((a, b) => b.count - a.count),
			byModel: breakdown(rowsBy((vehicle) => vehicle.designation)),
			byOperator: breakdown(rowsBy((vehicle) => vehicle.operatorName)),
			byType: breakdown(rowsBy((vehicle) => vehicle.type)),
			byAirConditioning: breakdown(rowsBy((vehicle) => vehicle.airConditioning)),
		};
	},
});
