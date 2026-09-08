import { useLocalStorage } from "usehooks-ts";

export function useDisplayNextCalls() {
	return useLocalStorage("display-next-calls", true);
}
