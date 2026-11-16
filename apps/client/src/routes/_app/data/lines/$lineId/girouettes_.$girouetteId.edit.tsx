import { createFileRoute } from "@tanstack/react-router";

import { GetLineGirouettesQuery } from "~/api/girouettes";
import { GetLineQuery } from "~/api/lines";
import { GetNetworkQuery } from "~/api/networks";
import { notFoundOnHttp404 } from "~/api/not-found";
import { GirouetteFormPage } from "./-components/girouettes/girouette-form-page";

export const Route = createFileRoute("/_app/data/lines/$lineId/girouettes_/$girouetteId/edit")({
	component: EditGirouettePage,
	loader: async ({ context: { queryClient }, params: { lineId } }) => {
		const line = await queryClient.ensureQueryData(GetLineQuery(+lineId));
		await Promise.all([
			queryClient.ensureQueryData(GetNetworkQuery(line.networkId, true)),
			queryClient.ensureQueryData(GetLineGirouettesQuery(+lineId)),
		]);
	},
	onError: notFoundOnHttp404,
});

function EditGirouettePage() {
	const { lineId, girouetteId } = Route.useParams();
	return <GirouetteFormPage lineId={+lineId} girouetteId={+girouetteId} />;
}
