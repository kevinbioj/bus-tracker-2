import * as z from "zod";
import { findRecentLineDestinations } from "../../../core/services/line-destination-service.js";
import { findLineDetails } from "../../../core/services/line-details-service.js";
import { findLineAlerts } from "../../../core/services/service-alert-service.js";
import { journeyStore } from "../../../core/store/journey-store.js";
import { idSchema } from "../../../utils/validator-helpers.js";
import { defineTool } from "../../define-tool.js";
import { getLine } from "../../lookups/lines.js";
import { getNetwork } from "../../lookups/networks.js";
import { alertSchema, presentAlert } from "../../presenters/alert.js";
import { journeySchema, presentJourney } from "../../presenters/journey.js";
import {
	lineReferenceSchema,
	networkReferenceSchema,
	presentLineReference,
	presentNetworkReference,
} from "../../presenters/references.js";
import { nowIn } from "../../presenters/time.js";

const MAX_JOURNEYS_PER_DIRECTION = 60;
const NEXT_CALLS = 2;

const directionSchema = z.enum(["OUTBOUND", "INBOUND"]);

export const getLineStatusTool = defineTool({
	name: "get_line_status",
	title: "Real-time status of a line",
	description:
		"Real-time snapshot of a line, grouped by direction: every journey tracked right now (vehicle, destination, delay, next stops, position, disruption flag), destinations served in each direction, and headers of active traffic alerts. Use get_line_alerts for full alert texts and get_journey for all stops of one journey.",
	icon: "line",
	input: z.object({
		lineId: idSchema.describe("Line id from search_lines or get_network_lines."),
		direction: directionSchema.optional().describe("Only keep journeys running in this direction."),
	}),
	output: z.object({
		now: z.string(),
		line: lineReferenceSchema.extend({ archived: z.boolean(), latestServiceDate: z.string().nullable() }),
		network: networkReferenceSchema,
		trackedJourneyCount: z.number(),
		directions: z.array(
			z.object({
				direction: directionSchema.or(z.literal("UNKNOWN")),
				destinations: z.array(z.string()),
				trackedJourneyCount: z.number(),
				journeys: z.array(journeySchema),
			}),
		),
		recentDestinations: z.array(z.string()),
		alerts: z.array(alertSchema.pick({ header: true, effect: true, severity: true })),
	}),
	handler: async ({ lineId, direction }) => {
		const line = await getLine(lineId);
		const [network, details, recentDestinations, alerts] = await Promise.all([
			getNetwork(line.networkId),
			findLineDetails(line.id),
			findRecentLineDestinations(line.id),
			findLineAlerts(line, { direction }),
		]);

		const journeys = journeyStore
			.values()
			.filter((journey) => journey.lineId === line.id && (direction === undefined || journey.direction === direction))
			.toArray();

		const directions = Map.groupBy(journeys, (journey) => journey.direction ?? ("UNKNOWN" as const))
			.entries()
			.map(([journeyDirection, directionJourneys]) => ({
				direction: journeyDirection,
				destinations: [...new Set(directionJourneys.flatMap((journey) => journey.destination ?? []))].toSorted(),
				trackedJourneyCount: directionJourneys.length,
				journeys: directionJourneys
					.map((journey) =>
						presentJourney(journey, { timezone: network.timezone, lineNumber: line.number, callCount: NEXT_CALLS }),
					)
					.toSorted((a, b) => (a.calls[0]?.scheduled ?? "").localeCompare(b.calls[0]?.scheduled ?? ""))
					.slice(0, MAX_JOURNEYS_PER_DIRECTION),
			}))
			.toArray()
			.toSorted((a, b) => a.direction.localeCompare(b.direction));

		return {
			now: nowIn(network.timezone),
			line: {
				...presentLineReference(line),
				archived: line.archivedAt !== null,
				latestServiceDate: details?.latestServiceDate ?? null,
			},
			network: presentNetworkReference(network),
			trackedJourneyCount: journeys.length,
			directions,
			recentDestinations,
			alerts: alerts.map((alert) => {
				const { header, effect, severity } = presentAlert(alert);
				return { header, effect, severity };
			}),
		};
	},
});
