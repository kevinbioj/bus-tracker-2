import type { McpServer } from "@modelcontextprotocol/server";
import { instrument, PostHog } from "@posthog/mcp";

const SHUTDOWN_TIMEOUT_MS = 2_000;

const projectToken = process.env.POSTHOG_KEY;

const posthog = projectToken ? new PostHog(projectToken, { host: process.env.POSTHOG_HOST || undefined }) : undefined;

export function instrumentMcpServer(server: McpServer) {
	if (posthog !== undefined) instrument(server, posthog, { collectFeedback: true });
}

export async function shutdownMcpAnalytics() {
	await posthog?.shutdown(SHUTDOWN_TIMEOUT_MS);
}
