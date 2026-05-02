import { useQueryState } from "nuqs";

export function useNetworksListSearchQuery() {
	return useQueryState("q");
}
