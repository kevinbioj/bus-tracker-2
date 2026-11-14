import { useLocalStorage } from "usehooks-ts";

export function useOnlyNetworksWithHistory() {
	return useLocalStorage("only-networks-with-history", true);
}
