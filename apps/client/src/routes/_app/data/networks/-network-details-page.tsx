import { useSuspenseQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";

import { GetNetworkQuery } from "~/api/networks";
import { DataPageLayout } from "~/routes/_app/data/-components/data-page-layout";
import { NetworkPage } from "~/routes/_app/data/-components/networks/network-page";

export function NetworkDetails() {
	const { networkId } = useParams({ from: "/_app/data/networks/$networkId" });

	const { data: network } = useSuspenseQuery(GetNetworkQuery(+networkId, true));

	return (
		<DataPageLayout network={network} title={`${network.name} – Données – Bus Tracker`}>
			<NetworkPage networkId={network.id} />
		</DataPageLayout>
	);
}
