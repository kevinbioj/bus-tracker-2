import { createFileRoute, Outlet } from "@tanstack/react-router";

import { LoadingIndicator } from "~/components/loading-indicator";
import { WelcomeBack } from "~/components/welcome-back";
import { NavigationBar } from "~/layout/navigation-bar";

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
