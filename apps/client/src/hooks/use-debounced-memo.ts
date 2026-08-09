import { type DependencyList, useEffect, useRef, useState } from "react";

export function useDebouncedMemo<T>(fn: () => T, debounceDelayMs: number, deps: DependencyList) {
	const fnRef = useRef(fn);
	fnRef.current = fn;

	const [debouncedValue, setDebouncedValue] = useState(() => fn());

	useEffect(() => {
		setDebouncedValue(fnRef.current());
		const interval = setInterval(() => setDebouncedValue(fnRef.current()), debounceDelayMs);
		return () => clearInterval(interval);
	}, [debounceDelayMs, ...deps]);

	return debouncedValue;
}
