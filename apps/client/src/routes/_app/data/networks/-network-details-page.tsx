import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Link, useParams, useSearch } from "@tanstack/react-router";

import { GetNetworkQuery } from "~/api/networks";
import { GetVehiclesQuery } from "~/api/vehicles";
import { Canonical } from "~/components/seo";
import * as m from "~/paraglide/messages";
import { DataPageLayout } from "~/routes/_app/data/-components/data-page-layout";
import { NetworkLogo } from "~/routes/_app/data/-components/network-logo";
import { NetworkDataSourcesDialog } from "~/routes/_app/data/-components/networks/network-data-sources-dialog";
import { NetworkPage } from "~/routes/_app/data/-components/networks/network-page";
import { ViewOnMapButton } from "~/routes/_app/data/-components/view-on-map-button";
import { formatNetworkModes, getNetworkLabel, isActiveLine } from "~/utils/network-seo";

export function NetworkDetails() {
	const { networkId } = useParams({ from: "/_app/data/networks/$networkId" });
	const tab = useSearch({ from: "/_app/data/networks/$networkId", select: (search) => search.tab });

	const { data: network } = useSuspenseQuery(GetNetworkQuery(+networkId, true));
	const { data: vehicles } = useQuery({ ...GetVehiclesQuery(network.id), enabled: network.hasVehiclesFeature });

	const networkLabel = getNetworkLabel(network);
	const lineCount = m.seo_line_count({ count: network.lines.filter(isActiveLine).length });
	const description =
		vehicles === undefined
			? m.page_description_network_without_vehicles({ lineCount, network: networkLabel })
			: m.page_description_network({
					lineCount,
					network: networkLabel,
					vehicleCount: m.seo_vehicle_count({
						count: vehicles.filter((vehicle) => vehicle.archivedAt === null).length,
					}),
				});

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
			description={description}
			title={m.page_title_network_data({ modes: formatNetworkModes(network.lines), network: networkLabel })}
		>
			<Canonical
				path={`/data/networks/${network.id}${network.hasVehiclesFeature && tab === "lines" ? "?tab=lines" : ""}`}
			/>
			<NetworkPage network={network} />
		</DataPageLayout>
	);
}
