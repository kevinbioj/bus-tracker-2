import { type McpServer, ResourceNotFoundError, ResourceTemplate, type Variables } from "@modelcontextprotocol/server";

import { type BusTrackerTool, ToolFailure } from "../define-tool.js";
import { iconsOf } from "../icons.js";
import { searchNetworksTool } from "../tools/index.js";
import { RESOURCE_MIME_TYPE, resourceTemplates } from "./templates.js";
import { NETWORKS_URI, uriTemplates } from "./uris.js";

async function readAsJson(uri: URL, tool: BusTrackerTool, args: unknown) {
	try {
		const output = await tool.run(args);
		return { contents: [{ uri: uri.href, mimeType: RESOURCE_MIME_TYPE, text: JSON.stringify(output) }] };
	} catch (error) {
		if (error instanceof ToolFailure) throw new ResourceNotFoundError(uri.href);
		throw error;
	}
}

const variableOf = (variables: Variables, name: string) => {
	const value = variables[name];
	const raw = Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
	try {
		return decodeURIComponent(raw);
	} catch {
		return raw;
	}
};

export function registerResources(server: McpServer) {
	server.registerResource(
		"networks",
		NETWORKS_URI,
		{
			title: "Networks",
			description: "Every network tracked by Bus Tracker.",
			mimeType: RESOURCE_MIME_TYPE,
			icons: iconsOf("network"),
		},
		(uri) => readAsJson(uri, searchNetworksTool, {}),
	);

	for (const template of resourceTemplates) {
		server.registerResource(
			template.kind,
			new ResourceTemplate(uriTemplates[template.kind], {
				list: template.list,
				complete: { [template.variable]: template.complete },
			}),
			{
				title: template.title,
				description: template.description,
				mimeType: RESOURCE_MIME_TYPE,
				icons: iconsOf(template.icon),
			},
			(uri, variables) => readAsJson(uri, template.tool, template.argsOf(variableOf(variables, template.variable))),
		);
	}
}
