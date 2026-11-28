import { useEffect, useState } from "react";

import { getPostHog, withPostHog } from "~/utils/posthog";

export function useFeatureFlag(flag: string) {
	const [enabled, setEnabled] = useState(() => getPostHog()?.isFeatureEnabled(flag));

	useEffect(() => {
		let disposed = false;
		let unsubscribe: (() => void) | undefined;

		withPostHog((posthog) => {
			if (disposed) return;
			setEnabled(posthog.isFeatureEnabled(flag));
			unsubscribe = posthog.onFeatureFlags(() => setEnabled(posthog.isFeatureEnabled(flag)));
		});

		return () => {
			disposed = true;
			unsubscribe?.();
		};
	}, [flag]);

	return import.meta.env.VITE_PUBLIC_POSTHOG_KEY === undefined || Boolean(enabled);
}
