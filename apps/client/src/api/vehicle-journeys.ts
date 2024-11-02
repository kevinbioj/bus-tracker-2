import type { VehicleJourney } from "@bus-tracker/contracts";
import { queryOptions } from "@tanstack/react-query";

import { client } from "./client.js";

export const VehicleJourneysQuery = queryOptions({
	refetchInterval: 5_000,
	queryKey: ["vehicle-journeys"],
	queryFn: () => client.get("vehicle-journeys").then((response) => response.json<{ journeys: VehicleJourney[] }>()),
});
