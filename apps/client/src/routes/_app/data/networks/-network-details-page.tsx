import { useSuspenseQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";

import { GetNetworkQuery } from "~/api/networks";
import * as m from "~/paraglide/messages";
import { DataPageLayout } from "~/routes/_app/data/-components/data-page-layout";
import { NetworkDataSourcesDialog } from "~/routes/_app/data/-components/networks/network-data-sources-dialog";
import { NetworkPage } from "~/routes/_app/data/-components/networks/network-page";
import { ViewOnMapButton } from "~/routes/_app/data/-components/view-on-map-button";

export function NetworkDetails() {
	const { networkId } = useParams({ from: "/_app/data/networks/$networkId" });

	const { data: network } = useSuspenseQuery(GetNetworkQuery(+networkId, true));

	return (
		<DataPageLayout
			action={<NetworkDataSourcesDialog networkId={network.id} />}
			network={network}
			networkAction={<ViewOnMapButton search={{ "network-id": network.id }} />}
			title={m.page_title_network_data({ networkName: network.name })}
		>
			<NetworkPage hasVehiclesFeature={network.hasVehiclesFeature} networkId={network.id} />
		</DataPageLayout>
	);
}
