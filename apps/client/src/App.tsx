import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { SnackbarProvider } from "notistack";
import { NuqsAdapter } from "nuqs/adapters/tanstack-router";
import { useState } from "react";

import { TooltipProvider } from "~/components/ui/tooltip.js";

import { routeTree } from "./routeTree.gen";

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof buildRouter>;
	}
}

function buildRouter(queryClient: QueryClient) {
	return createRouter({
		routeTree,
		context: { queryClient },
		defaultPreload: "intent",
		defaultPendingMs: Number.POSITIVE_INFINITY,
		scrollRestoration: false,
	});
}

export default function App() {
	const [{ queryClient, routerInstance }] = useState(() => {
		const qc = new QueryClient();
		return { queryClient: qc, routerInstance: buildRouter(qc) };
	});

	return (
		<SnackbarProvider anchorOrigin={{ horizontal: "right", vertical: "top" }} autoHideDuration={2500}>
			<QueryClientProvider client={queryClient}>
				<TooltipProvider>
					<NuqsAdapter>
						<RouterProvider router={routerInstance} />
					</NuqsAdapter>
				</TooltipProvider>
			</QueryClientProvider>
		</SnackbarProvider>
	);
}
