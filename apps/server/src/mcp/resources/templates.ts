import type { CompleteResourceTemplateCallback, ListResourcesCallback } from "@modelcontextprotocol/server";

import {
	completeJourneyIds,
	completeLineIds,
	completeNetworkIds,
	completeStopRefs,
	completeVehicleIds,
} from "../completions.js";
import type { BusTrackerTool } from "../define-tool.js";
import { type IconName, networkLogoIcons } from "../icons.js";
import { loadNetworks } from "../lookups/networks.js";
import {
	getJourneyTool,
	getLineAlertsTool,
	getLineStatusTool,
	getNetworkTool,
	getStopDeparturesTool,
	getVehicleTool,
} from "../tools/index.js";
import { type ResourceKind, resourceUri } from "./uris.js";

export const RESOURCE_MIME_TYPE = "application/json";

export type ResourceTemplateDefinition = {
	kind: ResourceKind;
	variable: string;
	title: string;
	description: string;
	icon: IconName;
	tool: BusTrackerTool;
	argsOf: (id: string) => Record<string, unknown>;
	complete: CompleteResourceTemplateCallback;
	list?: ListResourcesCallback;
};

const listNetworks: ListResourcesCallback = async () => ({
	resources: [...(await loadNetworks()).values()]
		.toSorted((a, b) => a.name.localeCompare(b.name))
		.map((network) => ({
			uri: resourceUri("network", network.id),
			name: network.name,
			title: network.name,
			description: [network.authority, network.region].filter((part) => part !== null).join(" · ") || undefined,
			mimeType: RESOURCE_MIME_TYPE,
			icons: networkLogoIcons(network.logoHref, network.darkModeLogoHref),
		})),
});

export const resourceTemplates: ResourceTemplateDefinition[] = [
	{
		kind: "network",
		variable: "networkId",
		title: "Network",
		description:
			"Details of a network: operators, real-time tracking quality and data sources. Updates as journeys change.",
		icon: "network",
		tool: getNetworkTool,
		argsOf: (id) => ({ networkId: Number(id) }),
		complete: completeNetworkIds,
		list: listNetworks,
	},
	{
		kind: "line",
		variable: "lineId",
		title: "Line status",
		description: "Real-time status of a line, grouped by direction. Updates at most every 30 s while journeys move.",
		icon: "line",
		tool: getLineStatusTool,
		argsOf: (id) => ({ lineId: Number(id) }),
		complete: completeLineIds,
	},
	{
		kind: "lineAlerts",
		variable: "lineId",
		title: "Line alerts",
		description: "Active traffic alerts of a line, with full texts. Updates when alerts are added, changed or removed.",
		icon: "alert",
		tool: getLineAlertsTool,
		argsOf: (id) => ({ lineId: Number(id) }),
		complete: completeLineIds,
	},
	{
		kind: "vehicle",
		variable: "vehicleId",
		title: "Vehicle",
		description: "Record of a vehicle and the journey it runs right now. Updates at most every 30 s while it moves.",
		icon: "vehicle",
		tool: getVehicleTool,
		argsOf: (id) => ({ vehicleId: Number(id) }),
		complete: completeVehicleIds,
	},
	{
		kind: "journey",
		variable: "journeyId",
		title: "Journey",
		description: "A journey tracked right now, with all its remaining stops. Updates at most every 30 s while it runs.",
		icon: "journey",
		tool: getJourneyTool,
		argsOf: (id) => ({ journeyId: id }),
		complete: completeJourneyIds,
	},
	{
		kind: "stopDepartures",
		variable: "stopRef",
		title: "Stop departures",
		description: "Next departures at a stop within two hours. Updates at most every 30 s when the board changes.",
		icon: "stop",
		tool: getStopDeparturesTool,
		argsOf: (id) => ({ stopRef: id }),
		complete: completeStopRefs,
	},
];
