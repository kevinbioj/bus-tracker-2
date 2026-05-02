import { useSuspenseQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";

import { GetNetworkQuery } from "~/api/networks";
import * as m from "~/paraglide/messages";
import { DataPageLayout } from "~/routes/_app/data/-components/data-page-layout";
import { NetworkPage } from "~/routes/_app/data/-components/networks/network-page";

export function NetworkDetails() {
	const { networkId } = useParams({ from: "/_app/data/networks/$networkId" });

	const { data: network } = useSuspenseQuery(GetNetworkQuery(+networkId, true));

	return (
		<DataPageLayout network={network} title={m.page_title_network_data({ networkName: network.name })}>
			<NetworkPage networkId={network.id} />
		</DataPageLayout>
	);
}
