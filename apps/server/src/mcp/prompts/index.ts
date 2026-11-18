import { completable, type McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";

import {
	completeDestinations,
	completeLineNumbers,
	completeNetworkNames,
	completeStopNames,
	completeVehicleNumbers,
} from "../completions.js";
import { iconsOf } from "../icons.js";

type CompletionContext = { arguments?: Record<string, string> } | undefined;

const networkArgument = (description: string) =>
	completable(z.string().describe(description), (value) => completeNetworkNames(value));

const optionalNetworkArgument = (description: string) =>
	completable(z.string().optional().describe(description), (value) => completeNetworkNames(value ?? ""));

const userMessage = (text: string) => ({
	messages: [{ role: "user" as const, content: { type: "text" as const, text } }],
});

export function registerPrompts(server: McpServer) {
	server.registerPrompt(
		"next_departures",
		{
			title: "Next departures from a stop",
			description: "Next departures from a stop, with real-time information and disruptions.",
			icons: iconsOf("stop"),
			argsSchema: z.object({
				network: optionalNetworkArgument("Network or city, e.g. 'Astuce' or 'Rouen'."),
				stop: completable(
					z.string().describe("Stop name, e.g. 'Théâtre des Arts'."),
					(value, context: CompletionContext) => completeStopNames(value, context?.arguments?.network),
				),
			}),
		},
		({ network, stop }) =>
			userMessage(
				`What are the next departures from the stop "${stop}"${network ? ` (${network})` : ""}? ` +
					"Use search_networks if a network or city is given, then search_stops (with the networkId) and get_stop_departures. " +
					"Mention delays, cancellations and active alerts.",
			),
	);

	server.registerPrompt(
		"where_is_vehicle",
		{
			title: "Where is a vehicle",
			description: "Locate a vehicle by its fleet number and tell what it is doing.",
			icons: iconsOf("vehicle"),
			argsSchema: z.object({
				network: networkArgument("Network or city, e.g. 'Astuce' or 'Lyon'."),
				number: completable(
					z.string().describe("Fleet number painted on the vehicle."),
					(value, context: CompletionContext) => completeVehicleNumbers(value, context?.arguments?.network),
				),
			}),
		},
		({ network, number }) =>
			userMessage(
				`Where is vehicle number ${number} of the ${network} network right now? ` +
					"Use search_networks, search_vehicles then get_vehicle. If it is not in service, say when and on which line it was last seen.",
			),
	);

	server.registerPrompt(
		"line_disruptions",
		{
			title: "Disruptions on a line",
			description: "Current traffic disruptions and service status of a line, optionally in one direction.",
			icons: iconsOf("alert"),
			argsSchema: z.object({
				network: networkArgument("Network or city, e.g. 'TCL' or 'Caen'."),
				line: completable(z.string().describe("Line number, e.g. 'T2' or '5'."), (value, context: CompletionContext) =>
					completeLineNumbers(value, context?.arguments?.network),
				),
				destination: completable(
					z.string().optional().describe("Direction of travel, given as a destination."),
					(value, context: CompletionContext) =>
						completeDestinations(value ?? "", context?.arguments?.network, context?.arguments?.line),
				),
			}),
		},
		({ network, line, destination }) =>
			userMessage(
				`Are there disruptions on line ${line} of the ${network} network${destination ? ` towards ${destination}` : ""}? ` +
					"Use search_lines, then get_line_status to find the matching direction and get_line_alerts (with that direction) for full alert texts. " +
					"Summarise how many vehicles are running and any significant delays.",
			),
	);
}
