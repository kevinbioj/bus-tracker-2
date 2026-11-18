import * as z from "zod";

import { findLineVehicleAssignments } from "../../../core/services/line-assignment-service.js";
import { idSchema } from "../../../utils/validator-helpers.js";
import { defineTool, ToolFailure } from "../../define-tool.js";
import { compareLineNumbers, getLine } from "../../lookups/lines.js";
import { getNetwork } from "../../lookups/networks.js";
import { vehicleUrl } from "../../presenters/links.js";
import { lineReferenceSchema, presentLineReference } from "../../presenters/references.js";
import { todayIn, toLocalTime } from "../../presenters/time.js";

export const getLineVehicleAssignmentsTool = defineTool({
	name: "get_line_vehicle_assignments",
	title: "Vehicles that ran on a line",
	description:
		"Which vehicles ran on a line on a given service day, with their time ranges, plus the days of that month on which the line was operated. Only networks with fleet data record vehicles.",
	icon: "vehicle",
	input: z.object({
		lineId: idSchema.describe("Line id from search_lines or get_network_lines."),
		date: z.iso.date().optional().describe("Service day as YYYY-MM-DD, local to the network. Defaults to today."),
	}),
	output: z.object({
		line: lineReferenceSchema,
		date: z.string(),
		activeDaysThisMonth: z.array(z.string()),
		vehicles: z.array(
			z.object({
				vehicleId: z.number(),
				number: z.string(),
				designation: z.string().nullable(),
				url: z.string(),
				periods: z.array(z.object({ from: z.string(), to: z.string().nullable() })),
			}),
		),
	}),
	handler: async ({ lineId, date }) => {
		const line = await getLine(lineId);
		const network = await getNetwork(line.networkId);

		const serviceDate = date !== undefined ? Temporal.PlainDate.from(date) : todayIn(network.timezone);
		if (Temporal.PlainDate.compare(serviceDate, todayIn(network.timezone)) > 0) {
			throw new ToolFailure("The service day cannot be in the future.");
		}

		const { activeDays, vehicles } = await findLineVehicleAssignments(line.id, serviceDate);

		return {
			line: presentLineReference(line),
			date: serviceDate.toString(),
			activeDaysThisMonth: activeDays.toSorted(),
			vehicles: vehicles
				.toSorted((a, b) => compareLineNumbers(a.number, b.number))
				.map((vehicle) => ({
					vehicleId: vehicle.id,
					number: vehicle.number,
					designation: vehicle.designation,
					url: vehicleUrl(vehicle.id),
					periods: vehicle.activities.map((activity) => ({
						from: toLocalTime(activity.startedAt, network.timezone),
						to: activity.endedAt !== null ? toLocalTime(activity.endedAt, network.timezone) : null,
					})),
				})),
		};
	},
});
