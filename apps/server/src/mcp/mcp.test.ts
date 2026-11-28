import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { describe, expect, it, vi } from "vitest";
import * as z from "zod";

vi.mock("../index.js", () => ({ redis: { isReady: false } }));

vi.mock("./lookups/networks.js", async () => {
	const { ToolFailure } = await import("./define-tool.js");
	const { matchesSearchText } = await import("../utils/search-text.js");
	const networks = new Map([
		[
			1,
			{
				id: 1,
				ref: "ASTUCE",
				name: "Réseau Astuce",
				authority: "Métropole Rouen Normandie",
				countryCode: "FR",
				timezone: "Europe/Paris",
				hasVehiclesFeature: true,
				region: "Normandie",
				logoHref: "https://assets.example/astuce.svg",
				darkModeLogoHref: null,
			},
		],
	]);
	return {
		loadNetworks: async () => networks,
		getNetwork: async (networkId: number) => {
			const network = networks.get(networkId);
			if (network === undefined) throw new ToolFailure(`No network found with id ${networkId}.`);
			return network;
		},
		timezoneOf: async () => "Europe/Paris",
		networkNames: async (networkIds: number[]) => networkIds.flatMap((id) => networks.get(id)?.name ?? []),
		matchesNetwork: (network: { name: string; authority: string | null; region: string | null }, query: string) =>
			matchesSearchText([network.name, network.authority, network.region], query),
	};
});

const { createBusTrackerServer } = await import("./server.js");
const { defineTool, ToolFailure } = await import("./define-tool.js");

async function rpc(handler: ReturnType<typeof createMcpHandler>, method: string, params?: unknown) {
	const response = await handler.fetch(
		new Request("http://localhost/mcp", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json, text/event-stream",
				"MCP-Protocol-Version": "2025-06-18",
			},
			body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
		}),
	);
	const body = await response.text();
	const json = body.startsWith("{")
		? body
		: body
				.split("\n")
				.find((line) => line.startsWith("data: "))
				?.slice(6);
	return JSON.parse(json ?? "null");
}

describe("Bus Tracker MCP server", () => {
	const handler = createMcpHandler(createBusTrackerServer);

	it("exposes read-only tools with input and output schemas", async () => {
		const { result } = await rpc(handler, "tools/list");
		expect(result.tools).toHaveLength(20);
		for (const tool of result.tools) {
			expect(tool.annotations.readOnlyHint).toBe(true);
			expect(tool.inputSchema.type).toBe("object");
			expect(tool.outputSchema.type).toBe("object");
			expect(tool.description.length).toBeGreaterThan(40);
		}
	});

	it("returns structured content matching the text content", async () => {
		const { result } = await rpc(handler, "tools/call", {
			name: "search_networks",
			arguments: { query: "astu" },
		});
		expect(result.isError).toBeUndefined();
		expect(result.structuredContent.networks).toEqual([
			expect.objectContaining({ networkId: 1, name: "Réseau Astuce", region: "Normandie" }),
		]);
		expect(JSON.parse(result.content[0].text)).toEqual(result.structuredContent);
	});

	it("reports lookup failures to the model", async () => {
		const { result } = await rpc(handler, "tools/call", {
			name: "get_network_lines",
			arguments: { networkId: 42 },
		});
		expect(result.isError).toBe(true);
		expect(result.content[0].text).toBe("No network found with id 42.");
	});

	it("rejects invalid arguments before running the tool", async () => {
		const { result } = await rpc(handler, "tools/call", {
			name: "search_networks",
			arguments: { countryCode: "FRA" },
		});
		expect(result.isError).toBe(true);
		expect(result.content[0].text).toMatch(/validation/i);
	});

	it("lists prompts and resource templates", async () => {
		const prompts = await rpc(handler, "prompts/list");
		expect(prompts.result.prompts.map((prompt: { name: string }) => prompt.name)).toEqual([
			"next_departures",
			"where_is_vehicle",
			"line_disruptions",
		]);

		const templates = await rpc(handler, "resources/templates/list");
		expect(templates.result.resourceTemplates.map((template: { uriTemplate: string }) => template.uriTemplate)).toEqual(
			[
				"bus-tracker://networks/{networkId}",
				"bus-tracker://lines/{lineId}",
				"bus-tracker://lines/{lineId}/alerts",
				"bus-tracker://vehicles/{vehicleId}",
				"bus-tracker://journeys/{journeyId}",
				"bus-tracker://stops/{stopRef}/departures",
			],
		);
	});
});

describe("defineTool", () => {
	const failingTool = (error: Error) =>
		defineTool({
			name: "failing",
			title: "Failing",
			description: "Always fails.",
			icon: "info",
			input: z.object({}),
			output: z.object({}),
			handler: async () => {
				throw error;
			},
		});

	const callFailing = async (error: Error) => {
		const handler = createMcpHandler(() => {
			const server = new McpServer({ name: "test", version: "1.0.0" });
			failingTool(error).register(server);
			return server;
		});
		return (await rpc(handler, "tools/call", { name: "failing", arguments: {} })).result;
	};

	it("passes ToolFailure messages through", async () => {
		const result = await callFailing(new ToolFailure("Nothing here."));
		expect(result).toMatchObject({ isError: true, content: [{ type: "text", text: "Nothing here." }] });
	});

	it("hides unexpected errors behind a generic message", async () => {
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
		const result = await callFailing(new Error("connection refused to 10.0.0.12"));
		expect(result.isError).toBe(true);
		expect(result.content[0].text).not.toContain("10.0.0.12");
		expect(consoleError).toHaveBeenCalled();
		consoleError.mockRestore();
	});
});

describe("icons, completion and subscriptions", () => {
	const handler = createMcpHandler(createBusTrackerServer);

	it("advertises server, tool and network logo icons", async () => {
		const init = await rpc(handler, "initialize", {
			protocolVersion: "2025-06-18",
			capabilities: {},
			clientInfo: { name: "test", version: "1.0.0" },
		});
		expect(init.result.serverInfo.icons).toContainEqual(expect.objectContaining({ mimeType: "image/svg+xml" }));
		expect(init.result.capabilities.resources).toMatchObject({ subscribe: true });
		expect(init.result.capabilities.completions).toBeDefined();

		const { result } = await rpc(handler, "tools/list");
		for (const tool of result.tools) {
			expect(tool.icons.map((icon: { mimeType: string }) => icon.mimeType)).toEqual(["image/svg+xml", "image/png"]);
		}

		const resources = await rpc(handler, "resources/list");
		expect(resources.result.resources).toContainEqual(
			expect.objectContaining({
				uri: "bus-tracker://networks/1",
				icons: [
					{ src: "https://assets.example/astuce.svg", mimeType: "image/svg+xml", theme: "light" },
					{ src: "https://assets.example/astuce.svg", mimeType: "image/svg+xml", theme: "dark" },
				],
			}),
		);
	});

	it("completes prompt arguments and resource template variables", async () => {
		const prompt = await rpc(handler, "completion/complete", {
			ref: { type: "ref/prompt", name: "where_is_vehicle" },
			argument: { name: "network", value: "rou" },
		});
		expect(prompt.result.completion.values).toEqual(["Réseau Astuce"]);

		const template = await rpc(handler, "completion/complete", {
			ref: { type: "ref/resource", uri: "bus-tracker://networks/{networkId}" },
			argument: { name: "networkId", value: "astu" },
		});
		expect(template.result.completion.values).toEqual(["1"]);
	});

	it("streams resource updates to subscribers of the 2026-07-28 revision", async () => {
		const meta = {
			"io.modelcontextprotocol/protocolVersion": "2026-07-28",
			"io.modelcontextprotocol/clientInfo": { name: "test", version: "1.0.0" },
			"io.modelcontextprotocol/clientCapabilities": {},
		};
		const response = await handler.fetch(
			new Request("http://localhost/mcp", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json, text/event-stream",
					"MCP-Protocol-Version": "2026-07-28",
					"Mcp-Method": "subscriptions/listen",
				},
				body: JSON.stringify({
					jsonrpc: "2.0",
					id: 7,
					method: "subscriptions/listen",
					params: { notifications: { resourceSubscriptions: ["bus-tracker://lines/28"] }, _meta: meta },
				}),
			}),
		);
		expect(response.headers.get("content-type")).toContain("text/event-stream");

		const reader = response.body!.getReader();
		const decoder = new TextDecoder();
		const nextMessage = async () => {
			const { value } = await reader.read();
			return JSON.parse(decoder.decode(value).split("data: ")[1] ?? "null");
		};

		expect(await nextMessage()).toMatchObject({ method: "notifications/subscriptions/acknowledged" });
		handler.notify.resourceUpdated("bus-tracker://lines/99");
		handler.notify.resourceUpdated("bus-tracker://lines/28");
		expect(await nextMessage()).toMatchObject({
			method: "notifications/resources/updated",
			params: { uri: "bus-tracker://lines/28" },
		});
		await reader.cancel();
	});
});
