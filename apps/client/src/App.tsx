import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense, useState } from "react";
import { RouterProvider } from "react-router-dom";

import { NavigationBar } from "./layout/navigation-bar.jsx";
import { router } from "./router.jsx";

export default function App() {
	const [queryClient] = useState(() => new QueryClient());

	return (
		<QueryClientProvider client={queryClient}>
			<div className="flex h-[100dvh] flex-col-reverse lg:flex-row">
				<NavigationBar />
				<RouterProvider router={router} />
			</div>
		</QueryClientProvider>
	);
}
