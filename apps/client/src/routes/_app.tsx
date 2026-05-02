import { createFileRoute, Outlet } from "@tanstack/react-router";

import { LoadingIndicator } from "./_app/-components/loading-indicator";
import { NavigationBar } from "./_app/-components/navigation-bar";
import { WelcomeBack } from "./_app/-components/welcome-back";

export const Route = createFileRoute("/_app")({
	component: AppLayout,
});

function AppLayout() {
	return (
		<>
			<NavigationBar />
			<LoadingIndicator />
			<Outlet />
			<WelcomeBack />
		</>
	);
}
