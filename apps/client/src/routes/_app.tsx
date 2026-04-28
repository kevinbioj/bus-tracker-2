import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { Suspense, useLayoutEffect } from "react";

import { LoadingIndicator } from "~/components/loading-indicator";
import { WelcomeBack } from "~/components/welcome-back";
import { NavigationBar } from "~/layout/navigation-bar";

export const Route = createFileRoute("/_app")({
	component: AppLayout,
});

function AppLayout() {
	const pathname = useRouterState({ select: (state) => state.location.pathname });

	// biome-ignore lint/correctness/useExhaustiveDependencies: we want to force scroll to top on path change
	useLayoutEffect(() => {
		window.scrollTo(0, 0);
	}, [pathname]);

	return (
		<>
			<NavigationBar />
			<LoadingIndicator />
			<Suspense>
				<Outlet />
			</Suspense>
			<WelcomeBack />
		</>
	);
}
