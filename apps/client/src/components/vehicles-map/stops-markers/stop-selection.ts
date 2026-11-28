import { parseAsBoolean, parseAsString, useQueryStates } from "nuqs";

const stopSelectionParsers = {
	stopRef: parseAsString,
	stopPointRef: parseAsString,
	nearby: parseAsBoolean,
};

const stopSelectionUrlKeys = {
	stopRef: "stop-ref",
	stopPointRef: "stop-point",
	nearby: "nearby",
};

/**
 * Arrêt sélectionné, porté par l'URL : une station (`stop-ref`) ou un de ses quais (`stop-point`),
 * jamais les deux — le serveur retrouve la station d'un quai, le client n'a pas à la répéter.
 */
export function useStopSelection() {
	const [{ stopRef, stopPointRef, nearby }, setSelection] = useQueryStates(stopSelectionParsers, {
		urlKeys: stopSelectionUrlKeys,
	});

	return {
		/** Référence du tableau de passages : le quai s'il est choisi, la station sinon. */
		selectedRef: stopPointRef ?? stopRef,
		stopPointRef,
		nearby: nearby === true,
		selectStopArea: (ref: string) => void setSelection({ stopRef: ref, stopPointRef: null, nearby: null }),
		selectStopPoint: (ref: string) => void setSelection({ stopRef: null, stopPointRef: ref, nearby: null }),
		openNearby: () => void setSelection({ stopRef: null, stopPointRef: null, nearby: true }),
		closeNearby: () => void setSelection({ nearby: null }),
		clearSelection: () => void setSelection({ stopRef: null, stopPointRef: null }),
	};
}
