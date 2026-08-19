import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { NuqsAdapter } from "nuqs/adapters/tanstack-router";

import { PurpleScreenOfDeath } from "~/psod";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
	component: () => (
		<NuqsAdapter>
			<Outlet />
		</NuqsAdapter>
	),
	errorComponent: PurpleScreenOfDeath,
});
