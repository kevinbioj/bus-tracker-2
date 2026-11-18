import { createMcpHonoApp } from "@modelcontextprotocol/hono";
import { createMcpHandler } from "@modelcontextprotocol/server";
import type { Context } from "hono";

import { siteUrl } from "../options.js";
import { allowedOrigins, hono, redactError } from "../server.js";
import { createBusTrackerServer } from "./server.js";
import { lineAlertsFingerprint, stopDeparturesFingerprint } from "./subscriptions/fingerprints.js";
import { watchJourneys } from "./subscriptions/journey-watcher.js";
import { readListenedUris, trackListenStream } from "./subscriptions/listen-tracking.js";
import { watchByPolling } from "./subscriptions/poll-watcher.js";
import { createSubscriptionRegistry } from "./subscriptions/registry.js";
import { createThrottledNotifier } from "./subscriptions/throttled-notifier.js";

const MAX_REQUEST_BODY_SIZE = 16 * 1024;
const MAX_SUBSCRIPTIONS = 50;
const MAX_URIS_PER_SUBSCRIPTION = 20;
const NOTIFICATION_INTERVAL_MS = 30_000;
const POLL_INTERVAL_MS = 30_000;

export const mcpHandler = createMcpHandler(createBusTrackerServer, {
	maxRequestBodySize: MAX_REQUEST_BODY_SIZE,
	maxSubscriptions: MAX_SUBSCRIPTIONS,
	onerror: (error) => console.error("✘ MCP request failed:", redactError(error)),
});

const subscriptions = createSubscriptionRegistry();
const notifier = createThrottledNotifier(
	(uri) => mcpHandler.notify.resourceUpdated(uri),
	(uri) => subscriptions.has(uri),
	NOTIFICATION_INTERVAL_MS,
);

watchJourneys(subscriptions, notifier);
watchByPolling(subscriptions, notifier, {
	intervalMs: POLL_INTERVAL_MS,
	concurrency: 4,
	maxResourcesPerKind: MAX_SUBSCRIPTIONS * MAX_URIS_PER_SUBSCRIPTION,
	fingerprinters: { stopDepartures: stopDeparturesFingerprint, lineAlerts: lineAlertsFingerprint },
});

const mcpApp = createMcpHonoApp({
	host: "0.0.0.0",
	allowedHosts: [...new Set([siteUrl, ...allowedOrigins].map((origin) => new URL(origin).hostname)), "127.0.0.1"],
	maxRequestBodySize: MAX_REQUEST_BODY_SIZE,
});

mcpApp.all("/", async (c: Context) => {
	const parsedBody = c.get("parsedBody");
	const listenedUris = readListenedUris(parsedBody);
	if (listenedUris !== undefined && listenedUris.length > MAX_URIS_PER_SUBSCRIPTION) {
		return c.json(
			{
				jsonrpc: "2.0",
				id: (parsedBody as { id?: unknown }).id ?? null,
				error: { code: -32602, message: `At most ${MAX_URIS_PER_SUBSCRIPTION} resources per subscription.` },
			},
			400,
		);
	}

	const response = await mcpHandler.fetch(c.req.raw, { parsedBody });
	return listenedUris !== undefined
		? trackListenStream(response, c.req.raw.signal, () => subscriptions.track(listenedUris))
		: response;
});

hono.route("/mcp", mcpApp);
