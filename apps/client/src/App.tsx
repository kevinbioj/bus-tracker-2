import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { RouterProvider } from "react-router-dom";

import { TooltipProvider } from "~/components/ui/tooltip.js";

import { router } from "./router.jsx";
import { SnackbarProvider } from "notistack";

export default function App() {
	const [queryClient] = useState(() => new QueryClient());

	return (
		<SnackbarProvider anchorOrigin={{ horizontal: "right", vertical: "top" }} autoHideDuration={2500}>
			<QueryClientProvider client={queryClient}>
				<TooltipProvider>
					<RouterProvider router={router(queryClient)} />
				</TooltipProvider>
			</QueryClientProvider>
		</SnackbarProvider>
	);
}
