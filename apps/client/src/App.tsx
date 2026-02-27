import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SnackbarProvider } from "notistack";
import { NuqsAdapter } from "nuqs/adapters/react-router/v6";
import { useState } from "react";
import { RouterProvider } from "react-router-dom";

import { TooltipProvider } from "~/components/ui/tooltip.js";

import { router } from "./router.jsx";

export default function App() {
	const [queryClient] = useState(() => new QueryClient());

	return (
		<SnackbarProvider anchorOrigin={{ horizontal: "right", vertical: "top" }} autoHideDuration={2500}>
			<QueryClientProvider client={queryClient}>
				<TooltipProvider>
					<NuqsAdapter>
						<RouterProvider router={router(queryClient)} />
					</NuqsAdapter>
				</TooltipProvider>
			</QueryClientProvider>
		</SnackbarProvider>
	);
}
