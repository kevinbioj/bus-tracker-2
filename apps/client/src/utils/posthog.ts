import type { PostHog } from "posthog-js";

const apiKey = import.meta.env.VITE_PUBLIC_POSTHOG_KEY;

let client: PostHog | undefined;
let clientPromise: Promise<PostHog> | undefined;

const earlyErrors: unknown[] = [];
const bufferError = (event: ErrorEvent) => earlyErrors.push(event.error ?? new Error(event.message));
const bufferRejection = (event: PromiseRejectionEvent) => earlyErrors.push(event.reason);

if (apiKey !== undefined) {
	window.addEventListener("error", bufferError);
	window.addEventListener("unhandledrejection", bufferRejection);
}

export function loadPostHog() {
	if (apiKey === undefined) return undefined;

	clientPromise ??= import("posthog-js").then(({ posthog }) => {
		window.removeEventListener("error", bufferError);
		window.removeEventListener("unhandledrejection", bufferRejection);

		posthog.init(apiKey, {
			api_host: import.meta.env.VITE_PUBLIC_POSTHOG_API_HOST,
			autocapture: false,
			capture_exceptions: true,
			defaults: "2025-05-24",
			respect_dnt: true,
			ui_host: import.meta.env.VITE_PUBLIC_POSTHOG_UI_HOST,
		});
		posthog.register({
			build_hash: import.meta.env.VITE_BUILD_HASH,
			build_timestamp: import.meta.env.VITE_BUILD_TIMESTAMP,
		});
		for (const error of earlyErrors.splice(0)) posthog.captureException(error);

		client = posthog;
		return posthog;
	});
	return clientPromise;
}

export const getPostHog = () => client;

export function withPostHog(callback: (posthog: PostHog) => void) {
	if (client !== undefined) callback(client);
	else void loadPostHog()?.then(callback);
}

export const posthog = {
	capture: (...args: Parameters<PostHog["capture"]>) => withPostHog((client) => client.capture(...args)),
	captureException: (...args: Parameters<PostHog["captureException"]>) =>
		withPostHog((client) => client.captureException(...args)),
};
