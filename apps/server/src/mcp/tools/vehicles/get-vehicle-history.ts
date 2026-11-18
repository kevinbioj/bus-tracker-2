import { eq } from "drizzle-orm";
import * as z from "zod";

import { database } from "../../../core/database/database.js";
import { vehiclesTable } from "../../../core/database/schema.js";
import { findVehicleActivityTimeline } from "../../../core/services/vehicle-activity-service.js";
import { idSchema } from "../../../utils/validator-helpers.js";
import { defineTool, ToolFailure } from "../../define-tool.js";
import { loadLineLabels } from "../../lookups/lines.js";
import { getNetwork } from "../../lookups/networks.js";
import { vehicleUrl } from "../../presenters/links.js";
import { todayIn } from "../../presenters/time.js";

export const getVehicleHistoryTool = defineTool({
	name: "get_vehicle_history",
	title: "Monthly history of a vehicle",
	description:
		"Day-by-day history of a vehicle for one month: the lines it ran on and from when to when, most recent first.",
	icon: "vehicle",
	input: z.object({
		vehicleId: idSchema.describe("Vehicle id from search_vehicles."),
		month: z
			.string()
			.regex(/^\d{4}-\d{2}$/, "Expected a month such as 2026-11")
			.optional()
			.describe("Month as YYYY-MM. Defaults to the current month."),
	}),
	output: z.object({
		vehicleId: z.number(),
		number: z.string(),
		month: z.string(),
		days: z.array(
			z.object({
				date: z.string(),
				assignments: z.array(
					z.object({ line: z.string().optional(), lineId: z.number(), from: z.string(), to: z.string() }),
				),
			}),
		),
		url: z.string(),
	}),
	handler: async ({ vehicleId, month }) => {
		const [vehicle] = await database.select().from(vehiclesTable).where(eq(vehiclesTable.id, vehicleId));
		if (vehicle === undefined) throw new ToolFailure(`No vehicle found with id ${vehicleId}. Use search_vehicles.`);

		const network = await getNetwork(vehicle.networkId);
		const currentMonth = todayIn(network.timezone).toPlainYearMonth();
		const yearMonth = month !== undefined ? Temporal.PlainYearMonth.from(month) : currentMonth;
		if (Temporal.PlainYearMonth.compare(yearMonth, currentMonth) > 0) {
			throw new ToolFailure("The month cannot be in the future.");
		}

		const timeline = await findVehicleActivityTimeline(vehicle.id, yearMonth, network.timezone);
		const lines = await loadLineLabels(timeline.flatMap((day) => day.activities.map((activity) => activity.lineId)));

		return {
			vehicleId: vehicle.id,
			number: vehicle.number,
			month: yearMonth.toString(),
			days: timeline.map((day) => ({
				date: day.date.toString(),
				assignments: day.activities.map((activity) => ({
					line: lines.get(activity.lineId)?.number,
					lineId: activity.lineId,
					from: activity.startedAt,
					to: activity.updatedAt,
				})),
			})),
			url: vehicleUrl(vehicle.id),
		};
	},
});
