import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import LoadingBar, { type LoadingBarRef } from "react-top-loading-bar";

// Paramètres d'état d'interface, sans chargement associé : la carte y écrit le marqueur
// ou l'arrêt sélectionnés (véhicule fixé, arrêt ouvert).
const IGNORED_SEARCH_PARAMS = ["marker-id", "stop-ref", "stop-point"];

function stripIgnoredSearchParams(searchStr: string) {
	const searchParams = new URLSearchParams(searchStr);
	for (const param of IGNORED_SEARCH_PARAMS) searchParams.delete(param);
	return searchParams.toString();
}

export function LoadingIndicator() {
	const ref = useRef<LoadingBarRef>(null);
	// Comparaison sur le pathname et les search params (et non le href complet) pour couvrir les
	// navigations qui ne changent que les search params – comme le changement de mois sur une page
	// ligne – tout en ignorant celles qui ne touchent que le hash : la carte y écrit sa position à
	// chaque déplacement, ce qui n'est pas un chargement. Idem pour les search params d'état
	// d'interface (`IGNORED_SEARCH_PARAMS`).
	const isNavigationPending = useRouterState({
		select: (state) => {
			if (!state.isLoading) return false;

			const resolvedLocation = state.resolvedLocation;
			if (resolvedLocation === undefined) return true;

			return (
				state.location.pathname !== resolvedLocation.pathname ||
				stripIgnoredSearchParams(state.location.searchStr) !== stripIgnoredSearchParams(resolvedLocation.searchStr)
			);
		},
	});

	useEffect(() => {
		const loadingBar = ref.current;
		if (loadingBar === null) return;

		if (isNavigationPending) {
			loadingBar.continuousStart();
		} else {
			loadingBar.complete();
		}
	}, [isNavigationPending]);

	return <LoadingBar className="h-2" color="white" ref={ref} waitingTime={250} />;
}
