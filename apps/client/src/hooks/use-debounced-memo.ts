import { useEffect, useState } from "react";

export function useDebouncedMemo<T>(fn: () => T, debounceDelayMs: number) {
	const [debouncedValue, setDebouncedValue] = useState(() => fn());

	useEffect(() => {
		const interval = setInterval(() => setDebouncedValue(fn()), debounceDelayMs);
		return () => clearInterval(interval);
	});

	return debouncedValue;
}
