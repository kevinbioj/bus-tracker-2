import { type QueryKey, useQueryClient } from "@tanstack/react-query";
import type { LngLatBounds } from "maplibre-gl";
import { useEffect, useRef } from "react";

import { sendRealtimeMessage, subscribeRealtimeMessages } from "~/api/realtime";
import { GetStopMarkersQuery, type StopMarker, searchBounds } from "~/api/stops";

type UseRealtimeStopsOptions = {
	connected: boolean;
	bounds: LngLatBounds;
	loaded: boolean;
	networkId?: number;
	lineId?: number;
	withStopPoints: boolean;
};

export function useRealtimeStops({
	connected,
	bounds,
	loaded,
	networkId,
	lineId,
	withStopPoints,
}: UseRealtimeStopsOptions) {
	const queryClient = useQueryClient();
	const stops = useRef(new Map<string, StopMarker>());
	const queryKeysBySeq = useRef(new Map<number, QueryKey>());
	const nextSeq = useRef(0);

	useEffect(() => {
		if (!connected) return;

		stops.current.clear();
		queryKeysBySeq.current.clear();

		return subscribeRealtimeMessages((message) => {
			if (message.stops === undefined) return;

			const { seq, upsert, remove } = message.stops;
			for (const ref of remove) stops.current.delete(ref);
			for (const stop of upsert) stops.current.set(stop.ref, stop);

			for (const knownSeq of queryKeysBySeq.current.keys()) {
				if (knownSeq < seq) queryKeysBySeq.current.delete(knownSeq);
			}

			const queryKey = queryKeysBySeq.current.get(seq);
			if (queryKey !== undefined) {
				queryClient.setQueryData(queryKey, { items: [...stops.current.values()] });
			}
		});
	}, [connected, queryClient]);

	useEffect(() => {
		if (!connected) return;

		const seq = nextSeq.current++;
		if (!loaded) {
			stops.current.clear();
			sendRealtimeMessage({ type: "subscribe-stops", seq, subscription: null });
			return;
		}

		queryKeysBySeq.current.set(
			seq,
			GetStopMarkersQuery(bounds, { enabled: loaded, networkId, lineId, withStopPoints }).queryKey,
		);

		const { swLat, swLon, neLat, neLon } = searchBounds(bounds, withStopPoints);
		sendRealtimeMessage({
			type: "subscribe-stops",
			seq,
			subscription: {
				swLat: Math.max(swLat, -90),
				swLon: Math.max(swLon, -180),
				neLat: Math.min(neLat, 90),
				neLon: Math.min(neLon, 180),
				networkIds: networkId ? [networkId] : undefined,
				lineId,
				withStopPoints,
			},
		});
	}, [connected, bounds, loaded, networkId, lineId, withStopPoints]);

	useEffect(() => {
		return () => {
			sendRealtimeMessage({ type: "subscribe-stops", seq: nextSeq.current++, subscription: null });
		};
	}, []);
}
