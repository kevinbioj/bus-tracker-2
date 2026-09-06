import { type DependencyList, useEffect, useRef, useState } from "react";

// Les valeurs calculées ici sont des primitives, des tableaux de primitives ou des objets plats :
// recalculer en produit une nouvelle référence à chaque tick, alors que le contenu est le plus
// souvent identique (un horaire absolu ne bouge jamais). Comparer évite un rendu pour rien.
function isShallowEqual(a: unknown, b: unknown) {
	if (Object.is(a, b)) return true;
	if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
	if (Array.isArray(a) !== Array.isArray(b)) return false;

	const aRecord = a as Record<string, unknown>;
	const bRecord = b as Record<string, unknown>;
	const aKeys = Object.keys(aRecord);
	if (aKeys.length !== Object.keys(bRecord).length) return false;

	return aKeys.every((key) => Object.is(aRecord[key], bRecord[key]));
}

export function useDebouncedMemo<T>(fn: () => T, debounceDelayMs: number, deps: DependencyList) {
	const fnRef = useRef(fn);
	fnRef.current = fn;

	const [debouncedValue, setDebouncedValue] = useState(() => fn());

	useEffect(() => {
		const update = () =>
			setDebouncedValue((previous) => {
				const next = fnRef.current();
				return isShallowEqual(previous, next) ? previous : next;
			});

		update();
		const interval = setInterval(update, debounceDelayMs);
		return () => clearInterval(interval);
	}, [debounceDelayMs, ...deps]);

	return debouncedValue;
}
