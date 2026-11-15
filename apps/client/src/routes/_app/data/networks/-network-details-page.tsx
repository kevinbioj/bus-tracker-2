import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";

import { GetNetworkQuery } from "~/api/networks";
import * as m from "~/paraglide/messages";
import { DataPageLayout } from "~/routes/_app/data/-components/data-page-layout";
import { NetworkLogo } from "~/routes/_app/data/-components/network-logo";
import { NetworkDataSourcesDialog } from "~/routes/_app/data/-components/networks/network-data-sources-dialog";
import { NetworkPage } from "~/routes/_app/data/-components/networks/network-page";
import { ViewOnMapButton } from "~/routes/_app/data/-components/view-on-map-button";

export function NetworkDetails() {
	const { networkId } = useParams({ from: "/_app/data/networks/$networkId" });

	const { data: network } = useSuspenseQuery(GetNetworkQuery(+networkId, true));

	return (
		<DataPageLayout
			actions={
				<>
					<ViewOnMapButton search={{ "network-id": network.id }} />
					<NetworkDataSourcesDialog networkId={network.id} />
				</>
			}
			back={{
				label: m.map_network_list_back(),
				link: <Link search={{ region: network.regionId ?? undefined }} to="/data" />,
			}}
			heading={network.name}
			media={<NetworkLogo className="h-10 min-w-10 max-w-22 sm:h-12 sm:min-w-12 sm:max-w-27" network={network} />}
			subtitle={network.authority}
			title={m.page_title_network_data({ networkName: network.name })}
		>
			<NetworkPage network={network} />
		</DataPageLayout>
	);
}
