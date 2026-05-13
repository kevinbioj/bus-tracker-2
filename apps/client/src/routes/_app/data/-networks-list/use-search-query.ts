import { useQueryState } from "nuqs";

export function useNetworksListSearchQuery(key = "q") {
	return useQueryState(key);
}
