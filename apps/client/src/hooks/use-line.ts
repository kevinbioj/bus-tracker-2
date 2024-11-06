import { useSuspenseQuery } from "@tanstack/react-query";

import { GetNetworkQuery } from "~/api/networks";

export function useLine(networkId: number, lineId?: number) {
	const { data: network } = useSuspenseQuery(GetNetworkQuery(networkId));
	return network?.lines.find(({ id }) => id === lineId);
}
