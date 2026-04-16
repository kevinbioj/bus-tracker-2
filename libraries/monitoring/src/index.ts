import { PostHog } from "posthog-node";

let posthog: PostHog | undefined;
let processorId = "unknown";

export function initMonitoring(id: string): void {
	processorId = id;
	const key = process.env.POSTHOG_KEY;
	if (!key) return;

	posthog = new PostHog(key, {
		host: process.env.POSTHOG_HOST,
		flushAt: 1,
		flushInterval: 0,
	});

	process.on("unhandledRejection", (reason) => {
		captureException(reason);
	});
}

export function captureException(error: unknown, properties?: Record<string, unknown>): void {
	if (!posthog) return;
	const err = error instanceof Error ? error : new Error(String(error));
	posthog.captureException(err, processorId, properties);
}

export async function shutdownMonitoring(): Promise<void> {
	await posthog?.shutdown();
}
