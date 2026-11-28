import { useFeatureFlag } from "~/hooks/use-feature-flag";

export function useAirConditioningFeature() {
	return useFeatureFlag("air-conditioning");
}
