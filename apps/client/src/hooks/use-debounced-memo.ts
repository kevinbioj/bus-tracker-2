import { type DependencyList, useEffect, useState } from "react";

export function useDebouncedMemo<T>(fn: () => T, debounceDelayMs: number, deps: DependencyList) {
	const [debouncedValue, setDebouncedValue] = useState(() => fn());

	useEffect(() => {
		setDebouncedValue(fn());
		const interval = setInterval(() => setDebouncedValue(fn()), debounceDelayMs);
		return () => clearInterval(interval);
	}, [fn, debounceDelayMs, ...deps]);

	return debouncedValue;
}
