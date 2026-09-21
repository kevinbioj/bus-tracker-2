import { parseAsString, useQueryStates } from "nuqs";

const stopSelectionParsers = {
	stopRef: parseAsString,
	stopPointRef: parseAsString,
};

const stopSelectionUrlKeys = {
	stopRef: "stop-ref",
	stopPointRef: "stop-point",
};

/**
 * Arrêt sélectionné, porté par l'URL : une station (`stop-ref`) ou un de ses quais (`stop-point`),
 * jamais les deux — le serveur retrouve la station d'un quai, le client n'a pas à la répéter.
 */
export function useStopSelection() {
	const [{ stopRef, stopPointRef }, setSelection] = useQueryStates(stopSelectionParsers, {
		urlKeys: stopSelectionUrlKeys,
	});

	return {
		/** Référence du tableau de passages : le quai s'il est choisi, la station sinon. */
		selectedRef: stopPointRef ?? stopRef,
		stopPointRef,
		selectStopArea: (ref: string) => void setSelection({ stopRef: ref, stopPointRef: null }),
		selectStopPoint: (ref: string) => void setSelection({ stopRef: null, stopPointRef: ref }),
		clearSelection: () => void setSelection({ stopRef: null, stopPointRef: null }),
	};
}
