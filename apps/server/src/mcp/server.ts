import { McpServer } from "@modelcontextprotocol/server";

import { siteUrl } from "../options.js";
import { instrumentMcpServer } from "./analytics.js";
import { serverIcons } from "./icons.js";
import { registerPrompts } from "./prompts/index.js";
import { registerResources } from "./resources/index.js";
import { tools } from "./tools/index.js";

const INSTRUCTIONS = `Bus Tracker (${siteUrl}) tracks public transport vehicles (buses, coaches, trams, metros, trains, boats) in real time, mostly in France.

How to find things:
- Network: search_networks. Line: search_lines (works across networks) or get_network_lines. Stop: search_stops by name (pass networkId when known), or find_stops_nearby with coordinates.
- Live situation of a line, by direction: get_line_status. Full alert texts, optionally for one direction and/or stop: get_line_alerts.
- Next departures: get_stop_departures (accepts a stop ref or a platform ref from get_stop). All stops of a journey: get_journey.
- Fleet: search_vehicles, get_vehicle, get_vehicle_history, get_fleet_overview, get_line_vehicle_assignments.
- Missing data: get_announcements may report an outage.
- Missing capability, misleading result or anything worth telling the Bus Tracker team: use send_feedback when it is available.
- Live updates: resources bus-tracker://lines/{lineId}, lines/{lineId}/alerts, vehicles/{vehicleId}, journeys/{journeyId}, stops/{stopRef}/departures and networks/{networkId} can be subscribed to; updates are sent at most every 30 seconds per resource.

Conventions: times are local to the network, ISO 8601 with UTC offset. positionType GPS means located by the vehicle; ESTIMATED and SCHEDULED positions are computed from timetables. Directions are OUTBOUND/INBOUND, as published by the network. Cite the url fields when sending users to Bus Tracker.`;

export function createBusTrackerServer() {
	const server = new McpServer(
		{ name: "bus-tracker", title: "Bus Tracker", version: "2.1.0", websiteUrl: siteUrl, icons: serverIcons },
		{ instructions: INSTRUCTIONS, capabilities: { resources: { subscribe: true, listChanged: true } } },
	);
	instrumentMcpServer(server);

	for (const tool of tools) tool.register(server);
	registerPrompts(server);
	registerResources(server);

	return server;
}
