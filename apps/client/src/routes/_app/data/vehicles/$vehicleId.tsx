import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { GetNetworkQuery } from "~/api/networks";
import { GetVehicleQuery } from "~/api/vehicles";
import { VehicleDetails } from "~/pages/vehicle-details";

const searchSchema = z.object({
	month: z.string().optional(),
});

export const Route = createFileRoute("/_app/data/vehicles/$vehicleId")({
	component: VehicleDetails,
	validateSearch: searchSchema,
	loader: async ({ context: { queryClient }, params: { vehicleId } }) => {
		const vehicle = await queryClient.ensureQueryData(GetVehicleQuery(+vehicleId));
		await queryClient.ensureQueryData(GetNetworkQuery(vehicle.networkId));
	},
});
