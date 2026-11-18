import type { CallToolResult, McpServer, StandardSchemaWithJSON } from "@modelcontextprotocol/server";
import type * as z from "zod";

import { redactError } from "../server.js";
import { type IconName, iconsOf } from "./icons.js";

export class ToolFailure extends Error {}

const READ_ONLY_ANNOTATIONS = {
	readOnlyHint: true,
	destructiveHint: false,
	idempotentHint: true,
	openWorldHint: false,
} as const;

const INTERNAL_ERROR_MESSAGE = "Internal error while fetching Bus Tracker data. Try again later.";

type ToolSpec<Input extends z.ZodObject, Output extends z.ZodObject> = {
	name: string;
	title: string;
	description: string;
	icon: IconName;
	input: Input;
	output: Output;
	handler: (args: z.output<Input>) => Promise<z.input<Output>>;
};

export type BusTrackerTool = {
	name: string;
	run: (rawArgs: unknown) => Promise<unknown>;
	register: (server: McpServer) => void;
};

const textResult = (text: string, isError?: true): CallToolResult => ({
	content: [{ type: "text", text }],
	...(isError ? { isError } : {}),
});

export function toToolResult(error: unknown, toolName: string): CallToolResult {
	if (error instanceof ToolFailure) return textResult(error.message, true);
	console.error("✘ MCP tool '%s' failed:", toolName, redactError(error));
	return textResult(INTERNAL_ERROR_MESSAGE, true);
}

export function defineTool<Input extends z.ZodObject, Output extends z.ZodObject>(
	spec: ToolSpec<Input, Output>,
): BusTrackerTool {
	return {
		name: spec.name,
		run: async (rawArgs) => spec.handler(spec.input.parse(rawArgs)),
		register: (server) => {
			const inputSchema: StandardSchemaWithJSON = spec.input;
			const outputSchema: StandardSchemaWithJSON = spec.output;
			server.registerTool(
				spec.name,
				{
					title: spec.title,
					description: spec.description,
					inputSchema,
					outputSchema,
					annotations: { title: spec.title, ...READ_ONLY_ANNOTATIONS },
					icons: iconsOf(spec.icon),
				},
				async (args) => {
					try {
						const output: Record<string, unknown> = await spec.handler(args as z.output<Input>);
						return { ...textResult(JSON.stringify(output)), structuredContent: output };
					} catch (error) {
						return toToolResult(error, spec.name);
					}
				},
			);
		},
	};
}
