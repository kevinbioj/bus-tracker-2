import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/data/lines/$lineId/vehicle-assignments")({
	loader: ({ params: { lineId } }) => {
		throw redirect({ to: "/data/lines/$lineId", params: { lineId } });
	},
});
