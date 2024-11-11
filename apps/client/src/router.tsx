import { Suspense } from "react";
import { Outlet, createBrowserRouter } from "react-router-dom";

import { NavigationBar } from "~/layout/navigation-bar.js";
import MapPage from "~/pages/map.js";
import { NetworkDetails } from "~/pages/network-details";
import { NetworkList } from "~/pages/network-list.js";

export const router = createBrowserRouter([
	{
		element: (
			<Suspense>
				<NavigationBar />
				<Outlet />
			</Suspense>
		),
		children: [
			{
				path: "/",
				element: <MapPage />,
			},
			{
				path: "/data",
				element: <NetworkList />,
			},
			{
				path: "/data/:networkId",
				element: <NetworkDetails />,
			},
		],
	},
]);
