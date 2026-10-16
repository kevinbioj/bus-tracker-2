import { useFeatureFlagEnabled } from "posthog-js/react";

export function useAirConditioningFeature() {
	const enabled = useFeatureFlagEnabled("air-conditioning");
	return import.meta.env.VITE_PUBLIC_POSTHOG_KEY === undefined || Boolean(enabled);
}
