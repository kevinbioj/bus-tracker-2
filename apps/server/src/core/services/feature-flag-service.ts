import { PostHog } from "posthog-node";

const posthogKey = process.env.POSTHOG_KEY;

const posthog =
	posthogKey
		? new PostHog(posthogKey, {
				host: process.env.POSTHOG_HOST || undefined,
				personalApiKey: process.env.POSTHOG_FEATURE_FLAGS_KEY || undefined,
				featureFlagsPollingInterval: 30_000,
				sendFeatureFlagEvent: false,
			})
		: undefined;

export async function isFeatureEnabled(flag: string) {
	if (posthog === undefined) return true;

	try {
		const flags = await posthog.evaluateFlags("bus-tracker-server", { flagKeys: [flag], onlyEvaluateLocally: true });
		return flags.isEnabled(flag);
	} catch {
		return false;
	}
}
