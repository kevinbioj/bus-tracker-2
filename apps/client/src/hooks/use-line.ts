import { useQuery } from "@tanstack/react-query";

import { GetNetworkQuery } from "~/api/networks";

export function useLine(networkId?: number, lineId?: number) {
	const { data: network } = useQuery(GetNetworkQuery(networkId, true));
	return network?.lines.find(({ id }) => id === lineId);
}
