import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import LoadingBar, { type LoadingBarRef } from "react-top-loading-bar";

export function LoadingIndicator() {
	const ref = useRef<LoadingBarRef>(null);
	// Comparaison sur le href complet (et non le seul pathname) pour couvrir les navigations
	// qui ne changent que les search params, comme le changement de mois sur une page ligne.
	const isNavigationPending = useRouterState({
		select: (state) => state.isLoading && state.location.href !== state.resolvedLocation?.href,
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
