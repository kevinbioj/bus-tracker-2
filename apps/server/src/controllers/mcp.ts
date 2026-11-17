import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { createMcpServer } from "../core/mcp/mcp-server.js";
import { hono } from "../server.js";

hono.post("/mcp", async (c) => {
	const server = createMcpServer();
	const transport = new WebStandardStreamableHTTPServerTransport({
		sessionIdGenerator: undefined,
		enableJsonResponse: true,
	});

	try {
		await server.connect(transport);
		return await transport.handleRequest(c.req.raw);
	} finally {
		await server.close();
	}
});

hono.on(["GET", "DELETE"], "/mcp", (c) =>
	c.json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed." }, id: null }, 405, {
		Allow: "POST",
	}),
);
