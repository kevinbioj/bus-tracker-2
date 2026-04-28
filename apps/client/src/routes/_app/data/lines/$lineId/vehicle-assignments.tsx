import { createFileRoute } from "@tanstack/react-router";
import dayjs from "dayjs";
import { z } from "zod";

import { GetLineQuery, GetLineVehicleAssignmentsQuery } from "~/api/lines";
import { GetNetworkQuery } from "~/api/networks";
import { LineVehicleAssignments } from "~/pages/line-vehicle-assignments";

const searchSchema = z.object({
	date: z.string().optional(),
});

export const Route = createFileRoute("/_app/data/lines/$lineId/vehicle-assignments")({
	component: LineVehicleAssignments,
	validateSearch: searchSchema,
	loaderDeps: ({ search: { date } }) => ({ date }),
	loader: async ({ context: { queryClient }, params: { lineId }, deps: { date } }) => {
		const line = await queryClient.ensureQueryData(GetLineQuery(+lineId));
		const effectiveDate = date ?? line.latestServiceDate ?? dayjs().format("YYYY-MM-DD");
		await Promise.all([
			queryClient.ensureQueryData(GetNetworkQuery(line.networkId, true)),
			queryClient.ensureQueryData(GetLineVehicleAssignmentsQuery(+lineId, effectiveDate)),
		]);
	},
});
