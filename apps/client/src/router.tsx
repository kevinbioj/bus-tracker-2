import type { QueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Suspense } from "react";
import { createBrowserRouter, Outlet } from "react-router-dom";

import { GetLineQuery, GetLineVehicleAssignmentsQuery } from "~/api/lines";
import { GetNetworkQuery, GetNetworksQuery } from "~/api/networks";
import { GetRegionsQuery } from "~/api/regions";
import { GetVehicleQuery } from "~/api/vehicles";
import { LoadingIndicator } from "~/components/loading-indicator";
import { WelcomeBack } from "~/components/welcome-back";
import { NavigationBar } from "~/layout/navigation-bar";
import EmbeddableMapPage from "~/pages/embeddable-map";
import { HelpPage } from "~/pages/help";
import { LegalPage } from "~/pages/legal";
import { LineVehicleAssignments } from "~/pages/line-vehicle-assignments";
import MapPage from "~/pages/map";
import { NetworkDetails } from "~/pages/network-details";
import { NetworkList } from "~/pages/networks-list";
import { VehicleDetails } from "~/pages/vehicle-details";
import { PurpleScreenOfDeath } from "~/psod";

export const router = (queryClient: QueryClient) =>
	createBrowserRouter([
		{
			path: "/embed/:networkId",
			errorElement: <PurpleScreenOfDeath />,
			element: (
				<Suspense>
					<EmbeddableMapPage />
				</Suspense>
			),
		},
		{
			element: (
				<>
					<NavigationBar />
					<LoadingIndicator />
					<Suspense>
						<Outlet />
					</Suspense>
					<WelcomeBack />
				</>
			),
			errorElement: <PurpleScreenOfDeath />,
			children: [
				{
					path: "/",
					element: <MapPage />,
				},
				{
					path: "/help",
					element: <HelpPage />,
				},
				{
					path: "/legal",
					element: <LegalPage />,
				},
				{
					path: "/data",
					element: <NetworkList />,
					loader: async () => {
						await Promise.all([
							queryClient.ensureQueryData(GetRegionsQuery),
							queryClient.ensureQueryData(GetNetworksQuery),
						]);
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
					path: "/data/lines/:lineId/vehicle-assignments",
					element: <LineVehicleAssignments />,
					loader: async ({ params, request }) => {
						const { lineId } = params;
						const url = new URL(request.url);

						const line = await queryClient.ensureQueryData(GetLineQuery(+lineId!));
						const date = url.searchParams.get("date") ?? line.latestServiceDate ?? dayjs().format("YYYY-MM-DD");

						await queryClient.ensureQueryData(GetLineVehicleAssignmentsQuery(+lineId!, date));
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
