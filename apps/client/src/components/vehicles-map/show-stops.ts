import { useLocalStorage } from "usehooks-ts";

export function useShowStops() {
	return useLocalStorage("show-stops", true);
}
