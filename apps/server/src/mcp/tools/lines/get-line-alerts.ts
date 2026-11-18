import * as z from "zod";

import { findLineAlerts } from "../../../core/services/service-alert-service.js";
import { idSchema } from "../../../utils/validator-helpers.js";
import { defineTool } from "../../define-tool.js";
import { getLine } from "../../lookups/lines.js";
import { getNetwork } from "../../lookups/networks.js";
import { resolveStop } from "../../lookups/stops.js";
import { alertSchema, presentAlert } from "../../presenters/alert.js";
import { lineReferenceSchema, presentLineReference } from "../../presenters/references.js";
import { nowIn } from "../../presenters/time.js";

export const getLineAlertsTool = defineTool({
	name: "get_line_alerts",
	title: "Traffic alerts of a line",
	description:
		"Active traffic alerts (disruptions, detours, stop closures, strikes…) affecting a line, with full texts. Can be narrowed to one direction and/or one stop: alerts aimed only at the other direction or at other stops are then left out, while alerts aimed at that stop itself are added. Network-wide alerts are always included.",
	icon: "alert",
	input: z.object({
		lineId: idSchema.describe("Line id from search_lines or get_network_lines."),
		direction: z
			.enum(["OUTBOUND", "INBOUND"])
			.optional()
			.describe("Direction as reported by get_line_status (OUTBOUND / INBOUND)."),
		stopRef: z.string().min(1).max(200).optional().describe("Stop or platform ref from search_stops or get_stop."),
	}),
	output: z.object({
		now: z.string(),
		line: lineReferenceSchema,
		direction: z.enum(["OUTBOUND", "INBOUND"]).optional(),
		stop: z.object({ stopRef: z.string(), name: z.string() }).optional(),
		alerts: z.array(alertSchema),
	}),
	handler: async ({ lineId, direction, stopRef }) => {
		const line = await getLine(lineId);
		const network = await getNetwork(line.networkId);
		const stop = stopRef !== undefined ? await resolveStop(stopRef) : undefined;

		const alerts = await findLineAlerts(line, {
			direction,
			stop: stop !== undefined ? { stopAreaRef: stop.stopArea.ref, stopRefs: stop.stopRefs } : undefined,
		});

		return {
			now: nowIn(network.timezone),
			line: presentLineReference(line),
			direction,
			stop: stop !== undefined ? { stopRef: stopRef ?? stop.stopArea.ref, name: stop.stopArea.name } : undefined,
			alerts: alerts.map(presentAlert),
		};
	},
});
