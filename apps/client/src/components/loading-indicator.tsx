import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import LoadingBar, { type LoadingBarRef } from "react-top-loading-bar";

export function LoadingIndicator() {
	const ref = useRef<LoadingBarRef>(null);
	const isPathChangePending = useRouterState({
		select: (state) => state.isLoading && state.location.pathname !== state.resolvedLocation?.pathname,
	});

	useEffect(() => {
		const loadingBar = ref.current;
		if (loadingBar === null) return;

		if (isPathChangePending) {
			loadingBar.continuousStart();
		} else {
			loadingBar.complete();
		}
	}, [isPathChangePending]);

	return <LoadingBar className="h-2" color="white" ref={ref} waitingTime={250} />;
}
