import { decodeJourneyPath, decodeLinePath, type RealtimeJourneyUpdate } from "@bus-tracker/contracts";
import { type QueryClient, type QueryKey, useQueryClient } from "@tanstack/react-query";
import type { LngLatBounds } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";

import { GetLinePathQuery, GetLineQuery } from "~/api/lines";
import { type RealtimeMessage, sendRealtimeMessage, subscribeRealtimeMessages } from "~/api/realtime";
import { GetLineAlertsQuery, GetStopAlertsQuery, GetVehicleJourneyAlertsQuery } from "~/api/service-alerts";
import { GetStopDeparturesQuery } from "~/api/stops";
import {
	type DisposeableVehicleJourney,
	GetJourneyPathsQuery,
	GetVehicleJourneyMarkersQuery,
	GetVehicleJourneyQuery,
	getVehicleJourneyMarkersParams,
	type VehicleJourneyMarker,
	type VehicleJourneyMarkersFilter,
} from "~/api/vehicle-journeys";

function applyJourneyUpdate(queryClient: QueryClient, update: RealtimeJourneyUpdate<DisposeableVehicleJourney>) {
	const query = GetVehicleJourneyQuery(update.id);

	if ("unavailable" in update) {
		void queryClient.fetchQuery({ ...query, staleTime: 0 }).catch(() => undefined);
		return;
	}

	const current = queryClient.getQueryData(query.queryKey);
	if (current !== undefined && Date.parse(update.details.updatedAt) < Date.parse(current.updatedAt)) return;

	queryClient.setQueryData(query.queryKey, update.details);
}

function applyJourneyContext(queryClient: QueryClient, message: RealtimeMessage) {
	for (const { lineId, line } of message.lines ?? []) {
		if (line !== null) queryClient.setQueryData(GetLineQuery(lineId).queryKey, line);
	}

	for (const { lineId, path } of message.linePaths ?? []) {
		if (path !== null) queryClient.setQueryData(GetLinePathQuery(lineId).queryKey, decodeLinePath(path));
	}

	for (const { lineId, items } of message.lineAlerts ?? []) {
		queryClient.setQueryData(GetLineAlertsQuery(lineId).queryKey, items);
	}

	if (message.journeyAlerts !== undefined) {
		const { journeyId, items } = message.journeyAlerts;
		queryClient.setQueryData(GetVehicleJourneyAlertsQuery(journeyId).queryKey, items);
	}

	if (message.journeyPaths !== undefined) {
		const { journeyId, pathRef, paths } = message.journeyPaths;
		if (paths !== null) {
			queryClient.setQueryData(GetJourneyPathsQuery(journeyId, pathRef).queryKey, {
				path: decodeJourneyPath(paths.path),
				cancelled: paths.cancelled !== undefined ? decodeLinePath(paths.cancelled) : undefined,
			});
		}
	}

	if (message.stopAlerts !== undefined) {
		queryClient.setQueryData(GetStopAlertsQuery(message.stopAlerts.ref).queryKey, message.stopAlerts.items);
	}

	if (message.stopDepartures !== undefined) {
		const { ref, direction, lineId } = message.stopDepartures;
		const query = GetStopDeparturesQuery(ref, direction, lineId);
		if ("unavailable" in message.stopDepartures) {
			void queryClient.fetchQuery({ ...query, staleTime: 0 }).catch(() => undefined);
		} else {
			queryClient.setQueryData(query.queryKey, message.stopDepartures.departures);
		}
	}

	if (message.journey !== undefined) applyJourneyUpdate(queryClient, message.journey);
}

type UseRealtimeMarkersOptions = {
	connected: boolean;
	bounds: LngLatBounds;
	filter: VehicleJourneyMarkersFilter;
	activeJourneyId: string | null;
	preferencesKey: string;
};

export function useRealtimeMarkers({
	connected,
	bounds,
	filter,
	activeJourneyId,
	preferencesKey,
}: UseRealtimeMarkersOptions) {
	const queryClient = useQueryClient();
	const markers = useRef(new Map<string, VehicleJourneyMarker>());
	const queryKeysBySeq = useRef(new Map<number, QueryKey>());
	const nextSeq = useRef(0);

	const latest = useRef({ filter, activeJourneyId });
	useEffect(() => {
		latest.current = { filter, activeJourneyId };
	});

	const [lastTargetedJourneyId, setLastTargetedJourneyId] = useState(filter.targetedJourneyId);
	if (filter.targetedJourneyId !== undefined && filter.targetedJourneyId !== lastTargetedJourneyId) {
		setLastTargetedJourneyId(filter.targetedJourneyId);
	}

	useEffect(() => {
		if (!connected) return;

		markers.current.clear();
		queryKeysBySeq.current.clear();

		return subscribeRealtimeMessages((message) => {
			if (message.markers !== undefined) {
				const { seq, upsert, remove } = message.markers;
				for (const journeyId of remove) markers.current.delete(journeyId);
				for (const marker of upsert) markers.current.set(marker.id, marker);

				for (const knownSeq of queryKeysBySeq.current.keys()) {
					if (knownSeq < seq) queryKeysBySeq.current.delete(knownSeq);
				}

				const queryKey = queryKeysBySeq.current.get(seq);
				if (queryKey !== undefined) {
					queryClient.setQueryData(queryKey, { items: [...markers.current.values()] });
				}
			}

			applyJourneyContext(queryClient, message);
		});
	}, [connected, queryClient]);

	const { embeddedNetworkId, filteredNetworkId, lineId } = filter;

	// biome-ignore lint/correctness/useExhaustiveDependencies: resubscribing is driven by these values
	useEffect(() => {
		if (!connected) return;

		const currentFilter = latest.current.filter;
		const params = getVehicleJourneyMarkersParams(currentFilter, latest.current.activeJourneyId);
		const seq = nextSeq.current++;
		queryKeysBySeq.current.set(seq, GetVehicleJourneyMarkersQuery(bounds, currentFilter).queryKey);

		sendRealtimeMessage({
			type: "subscribe-markers",
			seq,
			swLat: Math.max(bounds.getSouthWest().lat, -90),
			swLon: Math.max(bounds.getSouthWest().lng, -180),
			neLat: Math.min(bounds.getNorthEast().lat, 90),
			neLon: Math.min(bounds.getNorthEast().lng, 180),
			networkIds: params.networkId ? [params.networkId] : undefined,
			lineIds: params.lineId ? [params.lineId] : undefined,
			positionTypes: params.positionTypes,
			countryCodes: params.countryCodes,
			includeMarker: params.includeMarker,
		});
	}, [connected, bounds, embeddedNetworkId, filteredNetworkId, lineId, lastTargetedJourneyId, preferencesKey]);

	useEffect(() => {
		if (!connected) return;
		sendRealtimeMessage({ type: "watch-journey", id: activeJourneyId });
	}, [connected, activeJourneyId]);
}
