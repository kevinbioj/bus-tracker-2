import * as z from "zod";

import { findJourneyAlerts } from "../../../core/services/service-alert-service.js";
import { journeyStore } from "../../../core/store/journey-store.js";
import { defineTool, ToolFailure } from "../../define-tool.js";
import { loadLineLabels } from "../../lookups/lines.js";
import { getNetwork } from "../../lookups/networks.js";
import { alertSchema, presentAlert } from "../../presenters/alert.js";
import { journeySchema, presentJourney } from "../../presenters/journey.js";
import { networkReferenceSchema, presentNetworkReference } from "../../presenters/references.js";
import { nowIn } from "../../presenters/time.js";

const MAX_CALLS = 100;

export const getJourneyTool = defineTool({
	name: "get_journey",
	title: "Details of a tracked journey",
	description:
		"Full real-time details of a journey tracked right now: vehicle, position, delay, every remaining stop with scheduled and expected times (skipped, added or relocated stops flagged), and traffic alerts aimed at this journey, its line in its direction, or its network.",
	icon: "journey",
	input: z.object({
		journeyId: z
			.string()
			.min(1)
			.max(300)
			.describe("journeyId from get_line_status, get_stop_departures, get_vehicle or find_nearby_vehicles."),
	}),
	output: journeySchema.extend({
		now: z.string(),
		network: networkReferenceSchema,
		missionCode: z.string().optional(),
		bikesAllowed: z.boolean().optional(),
		addedJourney: z.boolean(),
		alerts: z.array(alertSchema),
	}),
	handler: async ({ journeyId }) => {
		const journey = journeyStore.get(journeyId);
		if (journey === undefined) {
			throw new ToolFailure(`Journey ${journeyId} is not tracked anymore: it has probably ended.`);
		}

		const [network, lines, alerts] = await Promise.all([
			getNetwork(journey.networkId),
			loadLineLabels(journey.lineId !== undefined ? [journey.lineId] : []),
			findJourneyAlerts(journey),
		]);
		const lineNumber = journey.lineId !== undefined ? lines.get(journey.lineId)?.number : undefined;

		return {
			now: nowIn(network.timezone),
			...presentJourney(journey, { timezone: network.timezone, lineNumber, callCount: MAX_CALLS }),
			network: presentNetworkReference(network),
			missionCode: journey.missionCode,
			bikesAllowed: journey.bikesAllowed,
			addedJourney: journey.isAdded === true,
			alerts: alerts.map(presentAlert),
		};
	},
});
