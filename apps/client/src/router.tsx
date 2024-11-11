import { Suspense } from "react";
import { Outlet, createBrowserRouter } from "react-router-dom";

import { NavigationBar } from "~/layout/navigation-bar.js";
import MapPage from "~/pages/map.js";
import { NetworkDetails } from "~/pages/network-details";
import { NetworkList } from "~/pages/network-list.js";
import { VehicleDetails } from "~/pages/vehicle-details";

export const router = createBrowserRouter([
	{
		element: (
			<>
				<NavigationBar />
				<Suspense>
					<Outlet />
				</Suspense>
			</>
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
				path: "/data/networks/:networkId",
				element: <NetworkDetails />,
			},
			{
				path: "/data/vehicles/:vehicleId",
				element: <VehicleDetails />,
			},
		],
	},
]);
