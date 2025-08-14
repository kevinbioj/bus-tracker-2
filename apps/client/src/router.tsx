import UmamiAnalytics from "@danielgtmn/umami-react";
import type { QueryClient } from "@tanstack/react-query";
import { Suspense } from "react";
import { createBrowserRouter, Outlet } from "react-router-dom";

import { GetNetworkQuery, GetNetworksQuery } from "~/api/networks";
import { GetVehicleQuery } from "~/api/vehicles";
import { LoadingIndicator } from "~/components/loading-indicator";
import { WelcomeBack } from "~/components/welcome-back";
import { NavigationBar } from "~/layout/navigation-bar";
import MapPage from "~/pages/map";
import { NetworkDetails } from "~/pages/network-details";
import { NetworkList } from "~/pages/network-list";
import { VehicleDetails } from "~/pages/vehicle-details";

export const router = (queryClient: QueryClient) =>
	createBrowserRouter([
		{
			hydrateFallbackElement: null,
			element: (
				<>
					<UmamiAnalytics
						url="https://analytics.bus-tracker.fr"
						websiteId="f4a89135-764e-4bbb-ad87-1fabf11aee12"
						lazyLoad
					/>
					<NavigationBar />
					<LoadingIndicator />
					<Suspense>
						<Outlet />
					</Suspense>
					<WelcomeBack />
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
					loader: async () => {
						await queryClient.ensureQueryData(GetNetworksQuery);
					},
				},
				{
					path: "/data/networks/:networkId",
					element: <NetworkDetails />,
					loader: async ({ params }) => {
						const { networkId } = params;
						await queryClient.ensureQueryData(GetNetworkQuery(+networkId!, true));
					},
				},
				{
					path: "/data/vehicles/:vehicleId",
					element: <VehicleDetails />,
					loader: async ({ params }) => {
						const { vehicleId } = params;
						await queryClient.ensureQueryData(GetVehicleQuery(+vehicleId!));
					},
				},
			],
		},
	]);
