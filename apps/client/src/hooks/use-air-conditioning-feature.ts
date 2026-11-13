import { useEffect, useState } from "react";

import { getPostHog, withPostHog } from "~/utils/posthog";

const FLAG = "air-conditioning";

export function useAirConditioningFeature() {
	const [enabled, setEnabled] = useState(() => getPostHog()?.isFeatureEnabled(FLAG));

	useEffect(() => {
		let disposed = false;
		let unsubscribe: (() => void) | undefined;

		withPostHog((posthog) => {
			if (disposed) return;
			unsubscribe = posthog.onFeatureFlags(() => setEnabled(posthog.isFeatureEnabled(FLAG)));
		});

		return () => {
			disposed = true;
			unsubscribe?.();
		};
	}, []);

	return import.meta.env.VITE_PUBLIC_POSTHOG_KEY === undefined || Boolean(enabled);
}
